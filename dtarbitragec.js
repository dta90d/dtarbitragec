/*
 * Created by dta90d on 2017.12.06.
 *
 */

'use strict';

console.log('Starting app...');

const request = require('request'), Promise = require("bluebird"); //request for pulling JSON from api. Bluebird for Promises.

// For writing log data and analysing it
const fs = require('fs');

const express = require('express'),
    app = express(),
    helmet = require('helmet'),
    http = require('http').Server(app),
    io = require('socket.io')(http); // For websocket server functionality

app.use(helmet.hidePoweredBy({setTo: 'PHP/5.4.0'}));

const port = process.env.PORT || 3001;

app.use(express.static(__dirname + '/docs'));


http.listen(port, function () {
    console.log('listening on', port);
});


//////////////////////////////// REQUIRE PARTS /////////////////////////////////

require('./lib/market-settings.js')(); //Includes settings file.
// let db = require('./db.js'); //Includes db.js

// Global class Bot(<bot_args_object>).
// Functions that work with Bot: awake(), activateBots().
//require('./lib/bot.js')(); // Load Bot class.

// Global variable market_api. To access any market: market_api['market-name']
// Global variable markets_with_api. Array of markets with api.
require('./lib/bot-settings.js')(); // Load market settings for the bot.

// Global functions for simulating bots (reading and writing).
require('./lib/simulate.js')();

// Global function send_mail(data_obj, <send_to_mail_arr> [opt]).
require('./lib/mail.js')(); // Load interface for mailing.

///////////////////////////////// END REQUIRE //////////////////////////////////


//////////////////////////////////// ERRORS ////////////////////////////////////

const E_MODES_FILE = "Error: There's a problem with './data/modes' file. All modes are disabled.\nTo fix this error read README.md and run './configure modes'.";
let EF_MODES_FILE = false; // Flag.

const E_FINANCE_FILE = "Error: There's problem with './data/finance' file. Bots mode is disabled.\nTo fix this error read README.md and run './configure finance'.";
let EF_FINANCE_FILE = false;

////////////////////////////////// END ERRORS //////////////////////////////////


////////////////////////////////// SETTINGS ////////////////////////////////////

// MODES.
// Load Modes.
const f_modes = './data/modes';
const modes = fs.existsSync(f_modes) === true ? try_r ( () => { return check_modes(JSON.parse(fs.readFileSync(f_modes))) }, (e) => { EF_MODES_FILE = true; console.log(E_MODES_FILE + "\n", e); return {}; } ) : {}; // if there is a problem with file disable any modes.
// Activate modes.
let BOTS_MODE      = ( modes.bots_mode   !== undefined  && markets_with_api !== [] ) ? modes.bots_mode     : false; // Do we need to activate bots.
let SIMULATE_BOTS  = modes.simulate_bots !== undefined                               ? modes.simulate_bots : false; // Do we need to simulate bots.
let HISTORY        = modes.history       !== undefined                               ? modes.history       : false; // Do we need to write down markets' history.

// END MODES

// FINANCE
// Load Finance settings. Only needed if bots mode is on.
const f_finance = './data/finance';
const finance   = fs.existsSync(f_finance) === true ? try_r ( () => { return check_finance(JSON.parse(fs.readFileSync(f_finance))) }, (e) => { EF_FINANCE_FILE = true; BOTS_MODE = false; console.log(E_FINANCE_FILE + "\n", e); return {}; } ) : {};
// Activate finance settings.
const MIN_COST       = finance.min_cost !== undefined ? finance.min_cost : {}; //{ USD: 200,  BTC: 0.03, ETH: 0.7, EUR: 150 };
const MAX_COST       = finance.max_cost !== undefined ? finance.max_cost : {}; //{ USD: 1000, BTC: 0.07, ETH: 1.2, EUR: 500 };
const MARGIN_MARKETS = [ 'kraken', 'bitfinex', 'bittrex_GO', 'hitbtc_GO' ];
const LIMIT_MARKETS  = [ 'bittrex' ];
const MARGIN_BALANCE = [ 'kraken', 'bitfinex' ];
const AMOUNT_MULT    = finance.amount_mult    !== undefined ? finance.amount_mult    : 0; //0.6; // Part of the orderbook to take. 0 < x < 1.
const BALANCE_BUFFER = finance.balance_buffer !== undefined ? finance.balance_buffer : {}; //{ USD: 120, BTC: 0.015, ETH: 0.3, EUR: 100 };

const LIMIT_PRICE_BUFFER = finance.limit_price_buffer !== undefined ? finance.limit_price_buffer : 0; //0.8;

// Max commission for each market.
const coms = finance.commission !== undefined ? finance.commission : {}; /*{
    bitfinex: 0.2,
    kraken  : 0.26,
    hitbtc  : 0.1,
    bittrex : 0.25,
    poloniex: 0.25
};*/

// IO.
const BOTS_HOME    = './botV1';            // Directory to save bots.
const BOTDATA      = './data/botdata';     // File for loading bot api functions.
const SIMULATE     = './data/simulate';    // File for loading and saving simulations.
const HISTORY_ROOT = './textdb';           // Where to write history.
const LOTS         = './data-static/lots'; // File for loading lots and min values.
const LOGFILE      = './log/';             // Log directory.
const QUEUE        = './data/queue';       // Queue to identify each bot.
const TRIGGERS     = './data/triggers';    // Triggers to do some specific action.

//////////////////////////////// END SETTINGS //////////////////////////////////

if (BOTS_MODE == true) {
    console.log('Bots mode: [ON].');
}
else {
    console.log('Bots mode: [OFF].');
}

if (SIMULATE_BOTS == true) {
    console.log('Simulate bots mode: [ON].');
}
else {
    console.log('Simulate bots mode: [OFF].');
}
if (HISTORY == true) {
    console.log('History mode: [ON]. (Writing markets\' history to \'' + HISTORY_ROOT + '\' directory).');
}
else {
    console.log('History mode: [OFF].');
}

////////////////////////////// GLOBAL VARIABLES ////////////////////////////////

let coinNames = [];
let coin_prices = {};
let numberOfRequests = 0;

let results = [];

let lots     = getBotData(LOTS); // Save lots (for hitbtc).
let btcusd   = {}; // Save price of BTC to calculate the amount.
let ethusd   = {}; // Save price of ETH to calculate the amount.
let btceur   = {}; // Save price of EUR to calculate the amount.
let botdata  = getBotData(BOTDATA); // Load data needed for the bot.
let waitdata = []; // Save results of the shot operations.
let botdeals = []; // Save succeeded bot deals.

let simulate_botdeals = []; // Save simulated botdeals here.
let simulate_waitdata = {}; // Load and save <high/low> var for bot simulation.

let queue_num = getQueue(QUEUE);
let get_queue_arr = [];

let triggers = getTriggers(TRIGGERS);

//////////////////////////// END GLOBAL VARIABLES //////////////////////////////



// Send this data to browser on client's connection
io.on('connection', function (socket) {
    socket.emit('coinsAndMarkets', [marketNames, coinNames]);
    socket.emit('results', results);
});


// Redefine console.error to log data.
console.error = function (e) {
    console.log("****************************ERROR***************************");
    console.log(e);
    console.log("************************************************************");
    
    create_unless_dir(LOGFILE);

    let file = LOGFILE + (new Date()).toLocaleDateString() + ".err";
    if (fs.existsSync(file) == false) {
        fs.writeFileSync(file, "");
    }
    
    fs.appendFileSync(file, "\n\n" + e);
}

// Log bots actoins to log/<date>.bot
console.bot = function (msg) {
    console.log("***************************ACTION***************************");
    console.log(msg);
    console.log("************************************************************");
    
    create_unless_dir(LOGFILE);

    let file = LOGFILE + (new Date()).toLocaleDateString() + ".bot";
    if (fs.existsSync(file) == false) {
        fs.writeFileSync(file, "");
    }
    
    fs.appendFileSync(file, "\n\n" + msg);
}

function try_r (try_block, catch_block) {
    try {
        return try_block();
    }
    catch (e) {
        return catch_block(e);
    }
}

function wait(s) {
    return new Promise(function(resolve, reject) {
        try {
            setTimeout(resolve, Number(s), true);
        }
        catch (e) {
            console.error('Wait error: ' + e);
            resolve(false);
        }
    });
}

// Check './data/modes' file.
function check_modes (m) {
    let modes = [ 'bots_mode', 'simulate_bots', 'history' ];

    for (let i = 0; i < modes.length; i++) {
        let mode = modes[i];

        if (m[mode] === undefined) {
            console.log("Warning: no '" + mode + "' mode is specified in './data/modes' file. '" + mode + "' mode is disabled. Run './configure modes' to proper configure this setting.");
        }
        else if (typeof(m[mode]) !== 'boolean') {
            console.log("Error: type of '" + mode + "' mode is not boolean. '" + mode + "' is disabled. To fix this problem run './configure modes' command.");
        }
    }

    return m;
}

// Check if './data/finance' file has mistakes.
function check_finance (f) {

    if (f.min_cost === undefined) {
        throw new Error("min_cost is not defined.");
    }
    if (f.max_cost === undefined) {
        throw new Error("max_cost is not defined.");
    }
    if (f.balance_buffer === undefined) {
        throw new Error("balance_buffer is not defined.");
    }

    let curs = [ 'USD', 'BTC', 'ETH', 'EUR' ];

    // All curs are present and are numbers, max cost is bigger than min, balance buffer is above zero.
    for (let i = 0; i < curs.length; i++) {
        let cur = curs[i];

        let min = f.min_cost;
        let max = f.max_cost;
        let buf = f.balance_buffer;

        if (min[cur] === undefined) {
            throw new Error(cur + " min_cost is not defined.");
        }
        if (max[cur] === undefined) {
            throw new Error(cur + " max_cost is not defined.");
        }
        if (buf[cur] === undefined) {
            throw new Error(cur + " balance_buffer is not defined.");
        }
        if (typeof(min[cur]) !== 'number') {
            throw new Error("Type of " + cur + " in min_cost: '" + JSON.stringify(min) + "' is not a number.");
        }
        if (typeof(max[cur]) !== 'number') {
            throw new Error("Type of " + cur + " in max_cost: '" + JSON.stringify(max) + "' is not a number.");
        }
        if (typeof(buf[cur]) !== 'number') {
            throw new Error("Type of " + cur + " in balance_buffer: '" + JSON.stringify(buf) + "' is not a number.");
        }
        if (min[cur] > max[cur]) {
            throw new Error("Min cost of " + cur + " is greater than the max cost.");
        }
        if (buf[cur] < 0) {
            throw new Error("The balance buffer is less than 0.");
        }
    }

    // Amount multiplier is a number that is 0 < x < 1.
    if (f.amount_mult === undefined) {
        throw new Error("amount_mult is not defined.");
    }
    if (typeof(f.amount_mult) !== 'number') {
        throw new Error("amount_mult is not a number.");
    }
    if ( (f.amount_mult < 0) || (f.amount_mult > 1) ) {
        throw new Error("amount_mult is less than 0 or greater than 1.");
    }
    // Limit price buffer is a number that is 0 < x < 1.
    if (f.limit_price_buffer === undefined) {
        throw new Error("linit_price_buffer is not defined.");
    }
    if (typeof(f.limit_price_buffer) !== 'number') {
        throw new Error("limit_price_buffer is not a number.");
    }
    if ( (f.limit_price_buffer < 0) || (f.limit_price_buffer > 1) ) {
        throw new Error("limit_price_buffer is less than 0 or greater than 1.");
    }

    // Commission for each market is present in './lib/bot-settings.js'. It is a number that is greater or equal to 0 and less than 1.
    let markets = JSON.parse(JSON.stringify(markets_with_api)); // Global object from bot-settings.js.
    let coms    = f.commission;
    for (let i = 0; i < markets.length; i++) {
        let market = markets[i];
        if (coms[market] === undefined) {
            throw new Error("Missing commission for market: '" + market + "'.");
        }
        if (typeof (coms[market]) !== 'number') {
            throw new Error("Type of commission on market '" + market + "' is not a number.");
        }
        if ( (coms[market] < 0) || (coms[market] > 1) ) {
            throw new Error("Commission of market '" + market + "' is less than 0 or greater than 1.");
        }
    }

    return f;
}



function getMarketData(options, coin_prices, callback) { //GET JSON DATA
    return new Promise(function (resolve, reject) {
        request({
            url    : options.URL,
            method : 'GET',
            timeout: 5000
        }, async function (error, response, body) {
            try {
                let data = JSON.parse(body);
                console.log("Success", options.marketName);
                if (options.marketName) {

                    let newCoinPrices = await options.last(data, coin_prices);
                    numberOfRequests++;
//                    if (numberOfRequests >= 1) computePrices(coin_prices); // TODO: to understand why he did so, but for now I comment it down for no duplicate information
                    //let v_market = (options.marketName).replace("_GO", "");
                    // Save the price of BASES currencies for each market.
                    if ((newCoinPrices.USD_BTC !== undefined)
                     &&((newCoinPrices.USD_BTC[options.marketName + '_GO'] !== undefined)||(newCoinPrices.USD_BTC[options.marketName] !== undefined))) {
                        btcusd[options.marketName] = ( newCoinPrices.USD_BTC[options.marketName + '_GO'] !== undefined ? newCoinPrices.USD_BTC[options.marketName + '_GO'] : newCoinPrices.USD_BTC[options.marketName] );
                    }
                    
                    if ((newCoinPrices.USD_ETH !== undefined)
                     &&((newCoinPrices.USD_ETH[options.marketName + '_GO'] !== undefined)||(newCoinPrices.USD_ETH[options.marketName] !== undefined))) {
                        ethusd[options.marketName] = ( newCoinPrices.USD_ETH[options.marketName + '_GO'] !== undefined ? newCoinPrices.USD_ETH[options.marketName + '_GO'] : newCoinPrices.USD_ETH[options.marketName] );
                    }
                    
                    if ((newCoinPrices.EUR_BTC !== undefined)
                     &&((newCoinPrices.EUR_BTC[options.marketName + '_GO'] !== undefined)||(newCoinPrices.EUR_BTC[options.marketName + '_GO'] !== undefined))) {
                        btceur[options.marketName] = ( newCoinPrices.EUR_BTC[options.marketName + '_GO'] !== undefined ? newCoinPrices.EUR_BTC[options.marketName + '_GO'] : newCoinPrices.EUR_BTC[options.marketName] );
                    }
                    
                    resolve(newCoinPrices);

                }
                else {
                    resolve(data); // Never.
                }

            } catch (error) {
                console.log("Error getting JSON response from", options.URL, error); //Throws error
                reject(error);
            }

        });


    });
}

// Create a function to check for a directory existance
//+if there's no such directory, create one.
function create_unless_dir(dirname) {
    if (fs.existsSync(dirname) == false) 
        fs.mkdirSync(dirname);
}

// Save data to a text file for later analysis.
// Creates new file every 6 hours. Names it after time period
//+in format [./rootdir/archive/year/month/day/d.m.qX], where "X"
//+is number of the day. Also creates file last.txt with last data.
function saveData(jsonObj) {
    // Add the time at the moment to the results data
    //+in ISO8601 format as the first element of an array.
    var now = (new Date()).toLocaleString();
    jsonObj.unshift(now);
    
    // Format JSON to string and add a trailing comma
    //+to concatinate with all the future results.
    let data = JSON.stringify(jsonObj);
    data += ',';
    
    // Do the file naming
    // The filename will be build from two parts: today's date and the quarter
    //+of the day, as the information will be spread between four 6 hours' files
    //+and be put in the directories named after the year month and day.
    // For exaple: .../textdb/db/2017/8/30/30.08_quater_1.txt etc.
    
    
    // First manage the db main directories.
    let rootdir = HISTORY_ROOT; // root text database directory
    let archive = 'db';       // directory to archive the data
    var dir = rootdir;      // temporary variable for some directory
    create_unless_dir(dir); // create if there's no such directory
    
    // Then the directories connected with the date.
    var now = new Date(now); // generale date object
    let year = now.getFullYear().toString();
    let month = (now.getMonth() + 1).toString();
    let day = now.getDate().toString();
    
    // Create the directory path is there's no one.
    var arr = [ archive, year, month, day ];
    for (let s in arr) {
        dir += '/' + arr[s];
        create_unless_dir(dir);
    }
    
    // Solving the filename issue.
    // Set day and time to good looking format.
    if (month.length == 1)
        month = '0' + month;
    if (day.length == 1)
        day = '0' + day;
    // Calculate the quarter of the day.
    let quarter_num = Math.floor(now.getUTCHours() / 6) + 1;
    let filename = day + '.' + month + '.q' + quarter_num;
    
    let file = dir + '/' + filename;
    let last = rootdir + '/last.txt';
    let buffer = rootdir + '/.last.txt';
    // Create file if there's no one.
    if (fs.existsSync(file) == false) {
        if (fs.existsSync(buffer) == true)
            fs.writeFileSync(last, fs.readFileSync(buffer));
        
        fs.writeFileSync(file, '');
        fs.writeFileSync(buffer, '');
    }
    
    // Write data to the file.
    fs.appendFileSync(file, data);
    fs.appendFileSync(buffer, data);//TODO: Improve the code to not writing
                                    //+twice instead of copying a file.
//    console.log(data);
}


function isMarginMarket(market) {
    if (MARGIN_MARKETS.includes(market) == true) {
        return true;
    }
    else {
        return false;
    }
}

function isLimitMarket(market) {
    if (LIMIT_MARKETS.includes(market) == true) {
        return true;
    }
    else {
        return false;
    }
}

function isMarginBalance(market) {
    if (MARGIN_BALANCE.includes(market) == true) {
        return true;
    }
    else {
        return false;
    }
}

async function computePrices(data) {

    function loopData() {
        return new Promise(function (resolve, reject) {

            if (numberOfRequests >= 2) { //TODO:LOOK
                
                for (let coin in data) {
                    
                    if (Object.keys(data[coin]).length > 1) {
                        if (coinNames.includes(coin) == false) coinNames.push(coin);
                        let asks = [];
                        let bids = [];
                        for (let market in data[coin]) {
                            asks.push([data[coin][market].ask, market]);
                            bids.push([data[coin][market].bid, market]);
                        }
                        asks.sort(function (a, b) {
                            return a[0] - b[0];
                        });
                        bids.sort(function (a, b) {
                            return b[0] - a[0];
                        });
                        for (let i = 0; i < asks.length; i++) {
                            for (let j = 0; j < asks.length; j++) {
                                
                                // Continue if it is the same market.
                                //+or market without margin.
                                if  ((bids[i][1] == asks[j][1])
                                  ||!((isMarginMarket(bids[i][1]))
                                    ||(isMarginMarket(asks[j][1])))) {
                                    continue;
                                }
                                
                                let spread = bids[i][0]/asks[j][0];
                                
                                /*console.log("\ncoin:"+coin+" spread:"+(spread - 1) * 100 + '%'
					+"\nBID_"+bids[i][1]+":"+bids[i][0]
					+"\nASK_"+asks[j][1]+":"+asks[i][0]);//TODO:REMOVE*/
                                    
                                let bid_market = bids[i][1];
                                let ask_market = asks[j][1];
                                results.push(
                                    {
                                        coin: coin,
                                        spread: (spread - 1) * 100,
                                        high_market: { // bid_market, m1
                                            name: bid_market.replace("_GO", ""),
                                            bid: data[coin][bid_market].bid,
                                            ask: data[coin][bid_market].ask
                                        },
                                        low_market: { // ask market, m2
                                            name: ask_market.replace("_GO", ""),
                                            bid: data[coin][ask_market].bid,
                                            ask: data[coin][ask_market].ask
                                        }
    
                                    }
                                );
                            }
                        }
                    }
                }
                results.sort(function (a, b) {
                    return a.spread - b.spread;
                });
                console.log("\nCOUNT: " + results.length);//TODO: REMOVE
// console.log(botdata[0].coin);//TODO:REMOVE               
                resolve();
            }
            // If no internet.
            else {
                reject('May be there is connection problem. (Check internet)');
            }
        });
    }
    
    await loopData();

    io.emit('results', results);
    return results; // Return results as resolve(results).
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////// BOT /////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// For strelka.
let exec_queue = {
    kraken  : { buy: {}, sell: {} }, // e.g. { <coin>: [Bot1, Bot2, Bot3] }
    bitfinex: { buy: {}, sell: {} },
    bittrex : { buy: {}, sell: {} },
    hitbtc  : { buy: {}, sell: {} }
};

// For calc amount.
let balance_queue = {
    kraken  : {},
    bitfinex: {},
    bittrex : { USD: [], BTC: [], ETH: [], EUR: [] },
    hitbtc  : { USD: [], BTC: [], ETH: [], EUR: [] },
    
    close_bittrex: {} // e.g. { <cur>: [] }
};

//++++++++++++++++++++++++++++++++Constructor+++++++++++++++++++++++++++++++++//
function Bot(bot_args) {
    
    var self     = this; // For inner methods.
    
    self.dynamic = bot_args.dynamic_data;
    self.fixed   = bot_args.fixed_data;
    self.amount  = bot_args.deal_amount;
    self.state   = bot_args.bot_state;
    self.at      = bot_args.market_state;
    self.active  = bot_args.is_active;
    self.report  = bot_args.report;
    self.queue   = bot_args.queue_num;
    
    self.update  = function (x) {
        for (let i = 0; i < results.length; i++) {
            let result = results[i];
            //console.log(result);//TODO:REMOVE
            
            if (result.coin == self.fixed.coin) {
                
                // High --> straight.
                if ((self.at == 'high')
                  &&(result.high_market.name == self.fixed.high_market.name)
                  &&(result.low_market.name  == self.fixed.low_market.name)) {
                  
                    var spread      = result.spread;
                    var high_market = result.high_market;
                    var low_market  = result.low_market;
                }
                // Low --> reverse.
                else if ((self.at == 'low')
                  &&(result.high_market.name == self.fixed.low_market.name)
                  &&(result.low_market.name  == self.fixed.high_market.name)) {
                    
                    var spread      = result.spread;
                    var high_market = result.low_market;
                    var low_market  = result.high_market;
                }
                
                // UPDATE.
                if ((spread != undefined)
                  &&(high_market != undefined)
                  &&(low_market != undefined)) {
                    
                    self.dynamic.spread      = spread;
                    self.dynamic.high_market = high_market;
                    self.dynamic.low_market  = low_market;
                }
                else {
                    continue;
                }
            }
            else {
                continue;
            }
        }
        if (self.active == true) {
            setTimeout(self.update, x, x);
        }
    }
    
    self.start   = function () {
        if (self.state == 'start') {
            self.state = 'open';
            self.open();
            //setTimeout( self.open, (Math.floor(Math.random() * (1000 - 0 + 1)) + 0) );
        }
        else {
            self.open();
            //setTimeout( self.open, (Math.floor(Math.random() * (300 - 0 + 1)) + 0) );
        }
    };
    
    self.open    = async function () {
        if ((self.state == 'open') || (self.state == 'opening')) {
            _writeDeal();
            
            // PREPARE.
            let prepared = _prepare();
            
            // Wait for strelka queue.
            await _strelka(prepared.buy_market.name,
                           prepared.sell_market.name,
                           prepared.coin);
            
            // FIRE!
            let shot = await self.shoot(prepared.coin,
                                    prepared.buy_market,
                                    prepared.sell_market,
                                    self.dynamic.spread);
            
            if (shot == true) {
                self.state = 'opened'; //TODO:opening and opened are problems.
                self.at == 'high' ? self.at = 'low' : self.at = 'high';
                _writeDeal();
                _unlinkOrder(prepared.buy_market.name);
                _unlinkOrder(prepared.sell_market.name);
                
                //TODO:ADD botdeals
                self.monitor();
            }
            else {
                console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + 'Did not exec at available amount ' + self.available);
                self.start();
            }
        }
        else {
            self.monitor();
        }
    };
    
    // TODO:FIX if closing and orders was added.
    self.monitor = function () {
        if ((self.state == 'opened') || (self.state == 'close')) {
            
            //console.bot(self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + self.dynamic.coin + " monitor");//TODO:REMOVE
            
            // If we've found.
            if (self.at =='high'?self.dynamic.spread >= self.fixed.spread_high
                                :self.dynamic.spread >= self.fixed.spread_low) {
                
                self.state = 'close';
                self.close();
                //setTimeout( self.close, (Math.floor(Math.random() * (1000 - 0 + 1)) + 0) );
            }
            else {
                setTimeout(self.monitor, 1000);
            }
        }
        else {
            self.close();
            //setTimeout( self.close, (Math.floor(Math.random() * (300 - 0 + 1)) + 0) );
        }
    };
    
    self.close   = async function () {
        if ((self.state == 'close') || (self.state == 'closing')) {
            _writeDeal();
            
            // PREPARE.
            let prepared = _prepare();
            
            // Wait for strelka queue.
            await _strelka(prepared.buy_market.name,
                           prepared.sell_market.name,
                           prepared.coin);
            
            // FIRE!
            let shot = await self.shoot(prepared.coin,
                                    prepared.buy_market,
                                    prepared.sell_market,
                                    self.dynamic.spread);
            
            if (shot == true) {
                self.state = 'closed';
                self.at == 'high' ? self.at = 'low' : self.at = 'high';
                _writeDeal();
                _unlinkOrder(prepared.buy_market.name);
                _unlinkOrder(prepared.sell_market.name);
                
                self.die();
            }
            else {
                console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + 'Did not exec amount ' + self.report.open.real_sell_amount + ' at ' + self.report.open.sell_market + ' and amount ' + self.report.open.real_buy_amount + ' at ' + self.report.open.buy_market + ' with available amount ' + self.available);
                self.start();
            }
        }
        else {
            self.die();
        }
    };
    
    self.die = function () {
        self.active = false;
        setTimeout( _unlinkDeal, 2000 );
        console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + "DEAD.");
    };
    
    
    // NOTE: I give spread for bot deals.
    self.shoot = async function (coin, buy_market, sell_market, spread) {
        console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + 'SHOOT!');
        
        // Prepare data to buy and sell.
        let exec = false;
        let buy_ask  = self.dynamic.buy_ask;
        let sell_bid = self.dynamic.sell_bid;
        let buy_lev  = buy_market.lev;
        let sell_lev = sell_market.lev;
        let new_spread = spread;
        let buy_orderbook;
        let sell_orderbook;
        let amount;
        let calculated = {};
        
        if ((self.state != 'opening')&&(self.state != 'closing')) {
            
            // Calc amount, prices and check it.
            
            // Enter balance queue.
            if (self.state == 'open') {
                await _balance_queue(buy_market.name, sell_market.name, coin);
            }
            if (self.state == 'close') {
                if (buy_market.name == 'bittrex') {
                    await  _balance_queue('close_bittrex', 'close_bittrex', coin, 1);
                }
                else if (sell_market.name == 'bittrex') {
                    await  _balance_queue('close_bittrex', 'close_bittrex', coin, 1);
                }
            }
            
            do {
                calculated = await _calc(coin, buy_market.name,
                  sell_market.name, buy_lev, sell_lev,
                  (self.report.open.real_buy_amount  !== undefined ?
                   self.report.open.real_buy_amount  : self.amount),
                  (self.report.open.real_sell_amount !== undefined ?
                   self.report.open.real_sell_amount : self.amount));
            } while (calculated === false);
            
            // Leave balance queue.
            if (self.state == 'open') {
                _leave_balance_queue(buy_market.name, sell_market.name, coin);
            }
            if (self.state == 'close') {
                if (buy_market.name == 'bittrex') {
                    _leave_balance_queue('close_bittrex', 'close_bittrex', coin, 1);
                }
                else if (sell_market.name == 'bittrex') {
                    _leave_balance_queue('close_bittrex', 'close_bittrex', coin, 1);
                }
            }
            
            buy_ask        = Number(calculated.buy_ask  - buy_market.step);
            sell_bid       = Number(calculated.sell_bid + sell_market.step);
            buy_orderbook  = calculated.buy_ob;
            sell_orderbook = calculated.sell_ob;
            new_spread     = Number(calculated.new_spread);
            
            // If new spread is OK, exec. Else, die.
            exec = ( (calculated.amount <= 0) ? false : true );
        }
        else {
            exec = true;
        }
        
        
        // EXEC.
        if (exec == false) {
            self.state = ( self.state == 'open' ? 'die' : 'close' );
            
            _unlinkFactor(buy_market.name);
            _unlinkFactor(sell_market.name);
            _unlinkFactor(buy_market.name,  'factor_close_');
            _unlinkFactor(sell_market.name, 'factor_close_');
            
            exec_queue[buy_market.name].buy[coin].shift();
            exec_queue[sell_market.name].sell[coin].shift();
            
            _writeDeal();
            return false;
        }
        else {
            self.state  = ( (self.state == 'open'|| self.state == 'opening')
                            ? 'opening': 'closing' );
            
            self.dynamic.buy_ask  = buy_ask;
            self.dynamic.sell_bid = sell_bid;
            
            if ((calculated.amount_buy !== undefined)&&(calculated.amount_sell !== undefined)) {
                self.dynamic.amount_buy  = calculated.amount_buy;
                self.dynamic.amount_sell = calculated.amount_sell
            }
            
            
            self.amount = ( (calculated.amount !== undefined)
                                               ? calculated.amount
                                               : self.amount);
            amount = {
                buy : ( (calculated.amount_buy !== undefined)
                                               ? calculated.amount_buy
                                               : ((self.dynamic.amount_buy !== undefined)
                                                ? self.dynamic.amount_buy
                                                :((self.report.open.real_buy_amount  !== undefined)
                                                 ? self.report.open.real_buy_amount
                                                 : self.amount))),
                sell: ( (calculated.amount_sell !== undefined)
                                               ? calculated.amount_sell
                                               : ((self.dynamic.amount_sell !== undefined)
                                                ? self.dynamic.amount_sell
                                                : ((self.report.open.real_sell_amount !== undefined) 
                                                 ? self.report.open.real_sell_amount
                                                 : self.amount)))
            };
            
            _writeDeal(); // Save amount and state.
            
            // Send mail before executing.
            if (buy_orderbook !== undefined) {
                let subject = 'DEAL ' + coin + ' ' + self.at + ' ' + self.state
                                + " " + self.fixed.high_market.name
                                + "-" + self.fixed.low_market.name 
                                + " " + (new Date()).toLocaleString();
                let content =  "Trying to execute:\n\n"
                             + "    coin       : " + coin             + "\n"
                             + "    spread     : " + new_spread       + "\n"
                             + "    operation  : " + self.at          + "\n"
                             + "    sell_market: " + sell_market.name + "\n"
                             + "    buy_market : " + buy_market.name  + "\n"
                             + "    sell_price : " + sell_bid         + "\n"
                             + "    buy_price  : " + buy_ask          + "\n"
                             + "    available amount: " + self.available + "\n"
                             + "    amount     : " + self.amount      + "\n"
                             + "    amount sell: " + amount.sell      + "\n"
                             + "    amount buy : " + amount.buy       + "\n"
                                                                      + "\n"
                             + sell_market.name + " orderbook:"       + "\n"
                             + JSON.stringify(sell_orderbook.result, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n")  + "\n"
                                                                      + "\n"
                             + buy_market.name  + " orderbook:"       + "\n"
                             + JSON.stringify(buy_orderbook.result, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n")   + "\n"
                             + "********************************OPTIONAL********************************" + "\n"
                             + sell_market.name + " opt orderbook:"   + "\n"
                             + JSON.stringify(sell_orderbook.optional, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n") + "\n"
                                                                      + "\n"
                             + buy_market.name  + " opt orderbook:"   + "\n"
                             + JSON.stringify(buy_orderbook.optional, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n")  + "\n";
                
                send_mail( { subject: subject, content: content } );
            }
            
            // Execute!
            let [ bought, sold ] = [ _exec_deal(coin, amount.buy, buy_ask, 'buy',
                                                  buy_lev, buy_market.name ),
                                     _exec_deal(coin, amount.sell, sell_bid,'sell',
                                                 sell_lev, sell_market.name)];
            
            let shot = await Promise.all( [ bought, sold ] );
            
            if ((shot[0].state == true) && (shot[1].state == true)) {
                console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + 'SHOT.');
               
                // SAVE RESULTS. //TODO:IMPROVE
                let now  = (new Date()).toLocaleString();
                let real_sell_price  = shot[1].price;
                let real_buy_price   = shot[0].price;
                let real_sell_amount = shot[1].real_amount;
                let real_buy_amount  = shot[0].real_amount;
                let real_spread = (real_sell_price / real_buy_price - 1) * 100;
                let real_sell_cost   = shot[1].total_cost;
                let real_buy_cost    = shot[0].total_cost;
                let max_sell_coms    = real_sell_cost / 100 * coms[sell_market.name];
                let max_buy_coms     = real_buy_cost  / 100 * coms[buy_market.name];
                
                if (self.state == 'opening') {
                    let obj = {
                        date            : now,
                        coin            : coin,
                        spread          : spread,
                        new_spread      : new_spread,
                        real_spread     : real_spread,
                        operation       : self.at,
                        sell_market     : sell_market.name,
                        buy_market      : buy_market.name,
                        sell_price      : sell_bid,
                        buy_price       : buy_ask,
                        real_sell_price : real_sell_price,
                        real_buy_price  : real_buy_price,
                        amount_available: self.available,
                        amount          : self.amount,
                        amount_sell     : amount.sell,
                        amount_buy      : amount.buy,
                        real_sell_amount: real_sell_amount,
                        real_buy_amount : real_buy_amount,
                        real_sell_cost  : real_sell_cost,
                        real_buy_cost   : real_buy_cost,
                        max_sell_coms   : max_sell_coms,
                        max_buy_coms    : max_buy_coms
                    };
                    
                    self.report.open = obj;
                    
                    send_mail({
                        subject: 'COMPLETE '+coin+' '+self.at+' '+self.state
                                + " " + self.fixed.high_market.name
                                + "-" + self.fixed.low_market.name
                                + " " + (new Date()).toLocaleString(),
                        content: JSON.stringify(obj, null, 1)
                    });
                }
                else {
                    let obj = {
                        date            : now,
                        coin            : coin,
                        spread          : spread,
                        new_spread      : new_spread,
                        real_spread     : real_spread,
                        operation       : self.at,
                        sell_market     : sell_market.name,
                        buy_market      : buy_market.name,
                        sell_price      : sell_bid,
                        buy_price       : buy_ask,
                        real_sell_price : real_sell_price,
                        real_buy_price  : real_buy_price,
                        amount_available: self.available,
                        amount          : self.amount,
                        amount_sell     : amount.sell,
                        amount_buy      : amount.buy,
                        real_sell_amount: real_sell_amount,
                        real_buy_amount : real_buy_amount,
                        real_sell_cost  : real_sell_cost,
                        real_buy_cost   : real_buy_cost,
                        max_sell_coms   : max_sell_coms,
                        max_buy_coms    : max_buy_coms
                    };
                    
                    self.report.close = obj;
                    
                    let dirty_profit = (self.report.open.real_sell_cost - self.report.close.real_buy_cost) + (self.report.close.real_sell_cost - self.report.open.real_buy_cost);
                    let min_profit = dirty_profit - (self.report.open.max_sell_coms + self.report.open.max_buy_coms + self.report.close.max_sell_coms + self.report.close.max_buy_coms);
                    
                    self.report.profit = {
                        min_profit  : min_profit,
                        dirty_profit: dirty_profit
                    };
                    
                    send_mail({
                        subject: 'SUCCESS '+coin+' '+self.at+' '+self.state
                                + " " + self.fixed.high_market.name
                                + "-" + self.fixed.low_market.name
                                + " " + (new Date()).toLocaleString(),
                        content: "Success:\n"
                        + "\n" +"    min_profit      : "+self.report.profit.min_profit
                        + "\n" +"    dirty_profit     : "+self.report.profit.dirty_profit
                        + "\n" +"    real_spread_open : "+self.report.open.real_spread
                        + "\n" +"    real_spread_close: "+self.report.close.real_spread
                        + "\n" + ""
                        + "\n" + "------------------------------------------------------------------------"
                        + "\n" + "OPEN:"
                        + "\n" + JSON.stringify(self.report.open, null, 1)
                        + "\n" + "CLOSE:"
                        + "\n" + JSON.stringify(self.report.close, null, 1)
                    });
                    
                    botdeals.push(self.report);
                }
                
                return true;
            }
            else {
                console.error(Error('ПИЗДА! coin: ' + coin + " buy: " + buy_market + " sell: " + sell_market + " on spread: " + new_spread ));
                return false;
            }
        }
    };
    
    function _exec_deal(coin, amount, price, side, lev, market) {
        return new Promise(async function(resolve, reject) {
            
            let total_amount = amount; // Save original amount.
            
            // Create order.
            let order = _readOrder(market);
            
            // Convert amount if needed. (To lots or some else shit).
            var temp_amount = false;
            do {
                temp_amount = (lots[market].to_lots == true
                       ? _to_lots(amount, market, coin)
                       : amount);
            
            } while (temp_amount === false);
            amount = temp_amount;
            
            amount = (order.amount !== undefined ? order.amount : amount);
            
            // Wait until order is complete.
            let complete = [ false ]; // Syntax: [ <complete>, <order_status>,
                                      //+              <exec>, <exec_price> ].
            let total_cost = order.total_cost; // Save total cost of all canceled orders.
            let canceled_count = order.canceled_count; // How many times kraken CANCELED our order.
            
            let not_exec = { count: 0, coin: coin, side: side, price: price }; // Object to pass it via link.
            //if (market == 'bittrex') not_exec.limit = 2; // For limit markets.
            do {
                if (order.id === false) {
                    _writeOrder(order, market);
                }
                while (order.id === false) {
                    
                    console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + 'EXEC ' + coin + ' amount ' + amount + ' price ' + price + ' side ' + side + ' at ' + market); //TODO:REMOVE
                    
                    order.id = await market_api[market].add_order(coin, amount,
                                                             price, side, lev);
                }
                _writeOrder(order, market);
                
                //complete = true; //TODO:REMOVE
                // TODO:ADD if spread has gone and other difficult situations
                complete = await _is_complete(order, market, not_exec);
                if (complete[1] == 'canceled') {
                    let exec       = complete[2]; // For kraken executed
                    let exec_price = complete[3]; //+something while being
                    amount -= exec;               //+a canceled shit.
                    
                    total_cost += exec * exec_price; // Cost.
                    canceled_count++;                // CANCELED AGAIN!
                    
                    var temp_amount = amount;
                    amount = ((amount < _calc_min(coin, market, price, market, price) / price) ? 0 : amount);
                    
                    if (amount > 0) {
                        order.id = false;
                        order.amount = amount;
                        order.total_cost = total_cost;
                        order.canceled_count = canceled_count;
                        
                        not_exec.count = 0;
                        
                        // Set new price to be the first (For limit).
                        /*if (market == 'bittrex') {
                            let orderbook;
                            do {
                                orderbook = await market_api[market].get_orderbook(coin, side);
                            } while (orderbook === false);
                            
                            let new_price  = orderbook.result[orderbook.result.length - 1].price;
                            
                            price          = new_price;
                            not_exec.price = new_price;
                        }*/
                    }
                    else {
                        complete[0] = true;
                        amount      = temp_amount;
                    }
                }
            }
            while (complete[0] != true);
            
            _unlinkFactor(market);
            _unlinkFactor(market, 'factor_close_'); // Bittrex.
            
            // Quit strelka queue.
            exec_queue[market][side][coin].shift();
            
            let order_count = canceled_count; // Number of orders executed.
            
            
            // Convert amount left for lots markets.
            var temp_amount = amount;
            do {
                temp_amount = (lots[market].to_lots == true
                       ? _to_amount(amount, market, coin)
                       : amount);
            
            } while (temp_amount === false);
            amount = temp_amount;
            
            // Convert cost to no lots cost for lots markets.
            var temp_cost = total_cost;
            do {
                temp_cost = (lots[market].to_lots == true
                       ? _to_amount(total_cost, market, coin)
                       : total_cost);
            
            } while (temp_cost === false);
            
            total_cost    = temp_cost;
            total_amount -= amount;
            
            let real_price = total_cost / total_amount;
            
            resolve({
                state       : true,
                price       : real_price,
                real_amount : total_amount,
                minus_amount: amount,       //TODO:REMOVE
                total_cost  : total_cost    //TODO:REMOVE
            });
        });
    }
    
    // Check if order is complete.
    function _is_complete(_order, market, not_exec) {
        return new Promise(async function(resolve, reject) { 
            let complete = [ false ]; // Syntax: [ <complete>, <status>,
                                      //+              <exec>, <exec_price> ].
            let order_id = _order.id;
            // TODO:FIX loop for the win.
            let order = false;
            do {
                order = await market_api[market].request_state(order_id);
            } while (order == false);
            
            console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: Order id: " + order.id + " at " + market);
            
            if (order.state == 'canceled') { // Completed.
                not_exec.count = 0;
                complete.push(order.state, order.exec, order.price);
            }
            else if (order.orig - order.exec <= 0) { // TODO:REMOVE
                complete[0] = true;
                complete.push('canceled', order.exec, order.price);//only canceled.
            }
            
            if (order.orig - order.exec <= 0) { // Really completed.
                complete[0] = true;
            }
            
            else {
                not_exec.count++;
                
                // For limit.
                if ((not_exec.limit !== undefined)
                  &&(not_exec.count >= not_exec.limit)) {
                    
                    let orderbook = false;
                    while (orderbook == false) {
                        let side = (not_exec.side == 'buy' ? 'sell' : 'buy');
                        orderbook = await market_api[market].get_orderbook(
                                                                 not_exec.coin,
                                                                 side
                                                            );
                    }
                    if (orderbook.result[0].price != not_exec.price) { //NOTE: mb not needed.
                        let count = 0;
                        let canceled = false;
                        while ((canceled == false)&&(count < 2)) {
                            canceled = await market_api[market].cancel_order(order_id);
                            count++;
                        }
                    }
                } // end For limit
            }
            
            setTimeout(resolve, 2000, complete);
        });
    }
    
    function _prepare() {
        if (self.at == 'high') {
            var coin        = self.dynamic.coin;
            var buy_market  = self.dynamic.low_market;
            var sell_market = self.dynamic.high_market;
            
            // Push the steps from fixed to temporaty objects.
            buy_market.step  = self.fixed.low_market.step;
            sell_market.step = self.fixed.high_market.step;
            // And leverage.
            buy_market.lev   = self.fixed.low_market.lev;
            sell_market.lev  = self.fixed.high_market.lev;
        }
        else if (self.at == 'low') {
            var coin         = self.dynamic.coin;
            var buy_market   = self.dynamic.high_market;
            var sell_market  = self.dynamic.low_market;
            
            // Push the steps from fixed to temporaty objects.
            buy_market.step  = self.fixed.high_market.step;
            sell_market.step = self.fixed.low_market.step;
            // And leverage.
            buy_market.lev   = self.fixed.high_market.lev;
            sell_market.lev  = self.fixed.low_market.lev;
        }
        else {
            new Error('UNKNOWN ERROR');
        }
        return { coin: coin, buy_market: buy_market, sell_market: sell_market };
    }
    
    async function _calc(coin, buy_market, sell_market, buy_lev, sell_lev,
                               buy_amount, sell_amount) {
        
        let calculated = false;
        
        try {
            let cur = coin.split('_')[0];
            let s = ( (self.at == 'high') ? self.fixed.spread_high
                                          : self.fixed.spread_low );
            
            
            // Calc all available amount.
            let [ ob_buy, ob_sell ] = [ false, false ];
            
            while ((ob_buy === false)||(ob_sell === false)) {
                let buy  = market_api[buy_market].get_orderbook(coin, 'buy');
                let sell = market_api[sell_market].get_orderbook(coin, 'sell');
                
                let orderbooks = await Promise.all( [ buy, sell ] );
                ob_buy         = orderbooks[0];
                ob_sell        = orderbooks[1];
            }
            
            let [ buy_ob, sell_ob ] = [ JSON.parse(JSON.stringify(ob_buy.result)), JSON.parse(JSON.stringify(ob_sell.result)) ];
            
            if (((sell_ob[0].price / buy_ob[0].price - 1) * 100) > s) {
                
                let [ ask, bid ] = [ 0, 0 ];
                let stop = false;
                
                while (stop !== true) {
                    stop = ((sell_ob[bid].amount < buy_ob[ask].amount)
                         ? ((bid < sell_ob.length - 1)
                         ? (((sell_ob[bid + 1].price / buy_ob[ask].price - 1) * 100 > s)
                             ?  ((sell_ob[++bid].price = ((sell_ob[bid].price
                                                         * sell_ob[bid].amount
                               +  sell_ob[bid - 1].price * sell_ob[bid - 1].amount)
                               / (sell_ob[bid].amount    + sell_ob[bid - 1].amount)))
                             &&  (sell_ob[bid].amount = (sell_ob[bid].amount
                                                       + sell_ob[bid - 1].amount)))
                             : true) : true)
                         : ((ask < buy_ob.length - 1)
                         ? (((sell_ob[bid].price / buy_ob[ask + 1].price - 1) * 100 > s)
                             ?  ((buy_ob[++ask].price = ((buy_ob[ask].price
                                                        * buy_ob[ask].amount
                               +  buy_ob[ask - 1].price * buy_ob[ask - 1].amount)
                               / (buy_ob[ask].amount    + buy_ob[ask - 1].amount)))
                             &&  (buy_ob[ask].amount = (buy_ob[ask].amount
                                                      + buy_ob[ask - 1].amount)))
                             : true) : true));
                }
                
                // Take smaller price.
                let price = ( (sell_ob[bid].price > buy_ob[ask].price)
                            ? sell_ob[bid].price
                            : buy_ob[ask].price );
                
                // And smaller amount.
                let amount = ( (sell_ob[bid].amount < buy_ob[ask].amount) 
                                  ? sell_ob[bid].amount
                                  : buy_ob[ask].amount );
            
                // Round amount for lots markets.
                amount = _fix_lots(coin, buy_market, sell_market, amount);
                
                // Save amount for logs.
                self.available = amount;
                
                // TO BE SECURE.
                amount *= AMOUNT_MULT;
                
            // End calc all available amount.
                
                
                let final_amount;
                let amount_buy;
                let amount_sell;
                let new_spread = (sell_ob[bid].price / buy_ob[ask].price - 1) * 100;
                let cost = amount * price;
                
                // Calc equal amount if opening.
                if (self.state == 'open') {
                    
                    // Check if the balances is enough. ( << Factor )
                    cost = await _check_balance(coin, cost, buy_market, sell_market, buy_lev, sell_lev, price);
                    // Check if the amount is bigger then the maximum cost.
                    cost = ( (cost > MAX_COST[cur]) ? MAX_COST[cur] : cost );
                    // Check if the amount is less then the market and our min.
                    cost = ( (cost < MIN_COST[cur])
                           ||(cost < _calc_min(coin, buy_market, buy_ob[ask].price,
                                                   sell_market, sell_ob[bid].price))
                            ? 0 : cost);
                    
                    
                    final_amount = Number(cost / price);
                    final_amount = _fix_lots(coin, buy_market, sell_market, final_amount);
                    amount_buy   = final_amount;
                    amount_sell  = final_amount;
                    
                    _writeFactor(buy_market,  cost, coin.split('_')[0]);
                    _writeFactor(sell_market, ( isMarginBalance(sell_market) == true ? cost : amount_sell ), coin.split('_')[1]);
                    if (isMarginBalance(buy_market) != true) {
                        _writeFactor(buy_market, amount_buy, coin.split('_')[1], 'block_');
                    }
                    if (isMarginBalance(sell_market) != true) {
                        _writeFactor(sell_market, cost, coin.split('_')[0], 'block_');
                    }
                }
                
                // Check amount is enough if closing.
                if (self.state == 'close') {
                    
                    // Check balance for bittrex.
                    if (buy_market == 'bittrex') {
                        cost = buy_amount * buy_ob[ask].price;
                        cost = await _check_bittrex_close(coin, buy_amount, buy_ob[ask].price);
                        
                        buy_amount = cost / buy_ob[ask].price;
                        
                        // Check if the amount is less then the market min.
                        cost = ((cost < _calc_min(coin, buy_market, buy_ob[ask].price, buy_market, buy_ob[ask].price)) ? 0 : cost);
                        
                        _writeFactor('bittrex', cost, coin.split('_')[0], 'factor_close_')
                    }    
                    if (sell_market == 'bittrex') {
                        sell_amount = await _check_bittrex_close(coin, sell_amount);
                        
                        // Check if the amount is less then the market min.
                        cost = ((sell_amount * sell_ob[bid].price < _calc_min(coin, sell_market, sell_ob[bid].price, sell_market, sell_ob[bid].price)) ? 0 : cost);
                        
                        _writeFactor('bittrex', sell_amount, coin.split('_')[1], 'factor_close_')
                    }
                    
                    final_amount = ( (cost <= 0) ? 0 : final_amount );
                    
                    // Check if calculated amount is enough.
                    amount_buy  = buy_amount;
                    amount_sell = sell_amount;
                    
                    final_amount = ( amount_buy  > amount ? 0 : final_amount );
                    final_amount = ( amount_sell > amount ? 0 : final_amount );
                }
                
                // Calculate prices.
                let [ buy_ask, sell_bid ] = [ buy_ob[0].price, sell_ob[0].price ];
                let total_buy_cost  = 0;
                let total_sell_cost = 0;
                if (amount_buy < buy_ob[0].amount) {
                    total_buy_cost = ob_buy.result[0].price * amount_buy;
                }
                else {
                    let i = 0;
                    while (i < buy_ob.length) {
                        if (buy_ob[i].amount > amount_buy) {
                            break;
                        }
                        buy_ask = buy_ob[i].price;
                        i++;
                    }
                    let amount_left = amount_buy - buy_ob[i - 1].amount;
                    
                    total_buy_cost = buy_ask * buy_ob[i - 1].amount + ob_buy.result[i].price * amount_left;
                }    
                if (isLimitMarket(buy_market) == true) {
                    total_buy_cost += BALANCE_BUFFER[cur] * LIMIT_PRICE_BUFFER;
                }
                
                if (amount_sell < sell_ob[0].amount) {
                    total_sell_cost = ob_sell.result[0].price * amount_sell;
                }
                else {
                    let i = 0;
                    while (i < sell_ob.length) {
                        if (sell_ob[i].amount > amount_sell) {
                            break;
                        }
                        sell_bid = sell_ob[i].price;
                        i++;
                    }
                    let amount_left = amount_sell - sell_ob[i - 1].amount;
                    
                    total_sell_cost = sell_bid * sell_ob[i - 1].amount + ob_sell.result[i].price * amount_left;
                }
                if (isLimitMarket(sell_market) == true) {
                    total_sell_cost -= BALANCE_BUFFER[cur] * LIMIT_PRICE_BUFFER;
                }
                
                buy_ask  = total_buy_cost  / amount_buy;
                sell_bid = total_sell_cost / amount_sell;
                
                
                calculated = {
                    amount     : final_amount,
                    amount_buy : amount_buy,
                    amount_sell: amount_sell,
                    new_spread : new_spread,
                    buy_ask    : buy_ask,
                    sell_bid   : sell_bid,
                    buy_ob     : ob_buy,
                    sell_ob    : ob_sell
                };
            }
            else {
                calculated = {
                    amount: 0
                };
                
                self.available = calculated.amount;
            }
        }
        catch (e) {
            calculated = false;
            console.error("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nCalc amount error " + e);
        }
        
        return calculated;
    }
    
    
    // Calc min cost for markets.
    function _calc_min(coin, buy_market, buy_price, sell_market, sell_price) {
        // Calc min amount and convert it to cost at the end.
        let res_amount = 0;
        
        // Take min amount from lots file.
        let buy_amount  = lots[buy_market][coin];
        let sell_amount = lots[sell_market][coin];
        
        // For bittrex cost must be bigger then 0.005 BTC.
        if (buy_market == 'bittrex') {
            let base  = coin.split('_')[0];
            let price = buy_price;
            if (base == 'USD') {
                price = buy_price / btcusd[buy_market].ask;
            }
            else if (base == 'ETH') {
                price = buy_price * ethusd[buy_market].ask;
                price = price     / btcusd[buy_market].ask;
            }
            else if (base == 'EUR') {
                price = buy_price / btceur[buy_market].ask;
            }
            buy_amount = 0.0005 / price;
        }
        else if (sell_market == 'bittrex') {
            let base  = coin.split('_')[0];
            let price = sell_price;
            if (base == 'USD') {
                price = sell_price / btcusd[sell_market].ask;
            }
            else if (base == 'ETH') {
                price = sell_price * ethusd[sell_market].ask;
                price = price      / btcusd[sell_market].ask;
            }
            else if (base == 'EUR') {
                price = sell_price / btceur[sell_market].ask;
            }
            sell_amount = 0.0005 / price;
        }
        
        // Take the biggest.
        res_amount = buy_amount > sell_amount
                   ? _fix_lots(coin, buy_market, sell_market, buy_amount)
                   : _fix_lots(coin, buy_market, sell_market, sell_amount);
        
        // Multiply by bigger price.
        let res_cost = res_amount * ((buy_price > sell_price) ? buy_price : sell_price);
        
        return res_cost;
    }
    
    // Check if balance is enough.
    async function _check_balance(coin, cost, buy_market, sell_market, buy_lev, sell_lev, price) {
        let new_cost = cost;
        let base = coin.split('_')[0];
        
        // Get balances.
        let [ b_buy, b_sell ] = [ false, false ];
        
        do {
            let [ buy, sell ] = [ market_api[buy_market].check_balance(coin, buy_lev),  market_api[sell_market].check_balance(coin, sell_lev, 1) ];
            let balances = await Promise.all([ buy, sell ]);
            [ b_buy, b_sell ] = [ balances[0], balances[1] ];
        } while ((b_buy === false)||(b_sell === false));
        
        
        // Minus factor for each.
        let buy_factor  = _calc_factor(buy_market, coin) + _calc_factor(buy_market, coin, 'block_');
        let sell_factor = _calc_factor(sell_market, coin, 'factor_', 1) + _calc_factor(sell_market, coin, 'block_', 1);
        
        b_buy   = _fix_balance(buy_market, b_buy,  coin);
        b_buy  -= buy_factor;
        b_sell  = _fix_balance(sell_market, b_sell, coin);
        b_sell -= buy_factor;
        
        // Convert sell balance from amount to cost for non margin.
        if (isMarginBalance(sell_market) != true) {
            b_sell *= price;
        }
        
        let balance = ( (b_buy > b_sell) ? b_sell : b_buy );
        
        balance -= BALANCE_BUFFER[base];
        if (cost >= balance) {
            new_cost = balance;
        }
        
        return new_cost;
    }
    
    async function _check_bittrex_close(coin, amount, price) {
        let cur = 1;
        if (price !== undefined) {
            amount *= price;
            cur = undefined;
        }
        
        let new_amount = amount;
        
        // Get balances.
        let balance = false; // Amount for sell, cost for buy.
        
        do {
            balance = await market_api.bittrex.check_balance(coin, 1, cur);
        } while (balance === false);
        
        // Minus factor for each.
        let factor = _calc_factor('bittrex', coin, 'factor_close_', cur);
        
        balance -= factor;
        
        if (amount > balance) {
            new_amount = balance;
        }
        
        return new_amount;
    }
    
    // Only for margin markets.
    function _fix_balance(market, balance, coin) {
        let base = coin.split('_')[0];
        if((isMarginBalance(market) == true) && (base != 'USD')) {
            if (base == 'BTC') {
                balance = balance / btcusd[market].ask;
            }
            else if (base == 'ETH') {
                balance = balance / ethusd[market].ask;
            }
            else if (base == 'EUR') {
                balance = balance / btcusd[market].ask * btceur[market].bid;
            }
            else {
                console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + "_fix_balance: Error: " + 'Unknown base ' + base + ".");
                balance = false;
            }
        }
        
        return balance;
    }
    
    function _fix_lots(coin, buy_market, sell_market, amount) {
        let res_amount = amount;
        // Round amount for lots markets.
        if ((lots[sell_market].lots == true)&&(lots[buy_market].lots == true)) {
            // Take the value for the biggest lot.
            res_amount = lots[sell_market][coin] > lots[buy_market][coin] ? _fix_amount(res_amount, sell_market, coin) : _fix_amount(res_amount, buy_market, coin);
        }
        else if (lots[sell_market].lots == true) {
            res_amount = _fix_amount(res_amount, sell_market, coin);
        }
        else if (lots[buy_market].lots  == true) {
            res_amount = _fix_amount(res_amount, buy_market, coin);
        }
        return res_amount;
    }
    
    // For lots (thx hitbtc) or smth else in future.
    function _fix_amount(amount, market, coin) {
        let fixed   = false;
        let in_lots = false;
        
        try {
            in_lots = _to_lots(amount, market, coin);
            fixed   = _to_amount(in_lots, market, coin);
        }
        catch (e) {
            console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + "_fix_amount: Error: " + e);
            fixed = false;
        }
        return fixed;
    }
    
    function _to_lots(amount, market, coin) {
        let in_lots = false;
        try {
            in_lots = Number(Number(amount / lots[market][coin]).toFixed());
        }
        catch (e) {
            console.log("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + "_to_lots: Error: " + e);
            in_lots = false;
        }
        return in_lots;
    }
    
    function _to_amount(in_lots, market, coin) {
        let in_amount = false;
        try {
            in_amount = Number(in_lots * lots[market][coin]);
        }
        catch (e) {
            console.log("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + "_to_amount: Error: " + e);
            in_amount = false;
        }
        return in_amount;
    }
    
    function _calc_factor(market, coin, prefix, cur) {
        prefix = ( (prefix === undefined) ? 'factor_' : prefix );
        cur    = ( (cur    === undefined) ? 0         : 1 );
        let base = coin.split('_')[cur];
        
        let factor = 0;
        // Active deals.
        let active = 0;
        let rootdir  = BOTS_HOME;
        let archives = fs.readdirSync(rootdir);
        
        let ID = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;
        for (let i = 0; i < archives.length; i++) {
            let archive = archives[i];
            
            let a_base  = (archive.substr(4, archive.indexOf('-', 4) - 4)).split('_')[cur];
            
            let dir = rootdir;
            dir += '/' + archive;
            
            let filename = prefix + market;
            
            let file = dir + '/' + filename;
            
            if (fs.existsSync(file) == true) {
                active++;
                let text = fs.readFileSync(file);
                let data = JSON.parse(text);
                let cost = data.cost;
                
                let f_cur = data.cur;
                if (isMarginBalance(market) == true) {
                    factor += cost;
                }
                else {
                    if (f_cur == base) {
                        factor += cost;
                    }
                }
            }
        }
        
        return factor;    
    }
    
    // Check for strelka.
    function _strelka(buy_market, sell_market, coin) {
        return new Promise(async function(resolve, reject) {
            
            // Get new queue_num.
            let old_queue = self.queue;
            
            get_queue_arr.push(self);
            while (self.queue == old_queue) {
                await wait(500);
            }
            
            if (exec_queue[sell_market].sell[coin] === undefined) {
                    exec_queue[sell_market].sell[coin] = [];
                }
                if (exec_queue[buy_market].buy[coin] === undefined) {
                    exec_queue[buy_market].buy[coin] = [];
                }
                exec_queue[sell_market].sell[coin].push(self);
                exec_queue[buy_market].buy[coin].push(self);
                
                do {
                    exec_queue[sell_market].sell[coin].sort( function(a, b) { return a.queue - b.queue } );
                    exec_queue[buy_market].buy[coin].sort( function(a, b) { return a.queue - b.queue } );
                    
                    if ((exec_queue[sell_market].sell[coin][0] !== self)
                       ||(exec_queue[buy_market].buy[coin][0]  !== self)) {
                        
                        await wait(500);
                    }
                    
                } while ((exec_queue[sell_market].sell[coin][0] !== self)
                       ||(exec_queue[buy_market].buy[coin][0]   !== self));
            
            resolve(true);
        });
    }
    
    function _balance_queue(buy_market, sell_market, coin, cur, margin_base) {
        return new Promise(async function(resolve, reject) {
            
            cur = ( (cur === undefined) ? 0 : 1 );
            
            let base   = coin.split('_')[cur];
            let m_base = ( (margin_base === undefined) ? 'all' : margin_base );
            let s_margin = isMarginBalance(sell_market);
            let b_margin = isMarginBalance(buy_market);
            
            if (balance_queue[sell_market][( (s_margin == true) ? m_base : base )] === undefined) {
                    balance_queue[sell_market][( (s_margin == true) ? m_base : base )] = [];
                }
                if (balance_queue[buy_market][( (b_margin == true) ? m_base : base )] === undefined) {
                    balance_queue[buy_market][( (b_margin == true) ? m_base : base )] = [];
                }
                balance_queue[sell_market][( (s_margin == true) ? m_base : base )].push(self);
                balance_queue[buy_market][(  (b_margin == true) ? m_base : base )].push(self);

                do {
                    balance_queue[sell_market][( (s_margin == true) ? m_base : base )].sort( function(a, b) { return a.queue - b.queue } );
                    balance_queue[buy_market][(  (b_margin == true) ? m_base : base )].sort( function(a, b) { return a.queue - b.queue } );

                    if ((balance_queue[sell_market][( (s_margin == true) ? m_base : base )][0] !== self)
                       ||(balance_queue[buy_market][( (b_margin == true) ? m_base : base )][0]  !== self)) {
                        
                        await wait(500);
                    }

                } while ((balance_queue[sell_market][( (s_margin == true) ? m_base : base )][0] !== self)
                       ||(balance_queue[buy_market][(  (b_margin == true) ? m_base : base )][0]  !== self));

            resolve(true);
        });
    }
    
    function _leave_balance_queue(buy_market, sell_market, coin, cur, margin_base) {
        
        cur = ( (cur === undefined) ? 0 : 1 );
        
        let base   = coin.split('_')[cur];
        let m_base = ( (margin_base === undefined) ? 'all' : margin_base );
        let s_margin = isMarginBalance(sell_market);
        let b_margin = isMarginBalance(buy_market);
        
        balance_queue[sell_market][( (s_margin == true) ? m_base : base )].shift();
        balance_queue[buy_market][(  (b_margin == true) ? m_base : base )].shift();
        
        return true;
    }
    
    // IO FUNCTIONS //

    function _writeDeal() {
        console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + "WRITE DEAL >> " + self.state);
        let jsonObj = {
            dynamic: self.dynamic,
            fixed  : self.fixed,
            amount : self.amount,
            at     : self.at,
            state  : self.state,
            active : self.active,
            report : self.report,
            queue  : self.queue
        };
        
        let data = JSON.stringify(jsonObj);
    
        // Do the file naming
        // The filename will be build from tree parts: today's date and the quarter
        //+of the day, as the information will be spread between four 6 hours' files
        //+and be put in the directories named after the year month and day.
        // For exaple: .../textdb/db/2017/8/30/30.08_quater_1.txt etc.
        
        // First manage the db main directories.
        let rootdir = BOTS_HOME; // root text database directory
        let archive = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;       // directory to archive the data
        var dir = rootdir;      // temporary variable for some directory
        create_unless_dir(dir); // create if there's
        
        dir += '/' + archive;
        create_unless_dir(dir);
        
        let filename = 'bot';
        
        let file = dir + '/' + filename;
        // Create file if there's no one.
        
        fs.writeFileSync(file, data);
    }
    
    function _unlinkDeal() {
        
        // First manage the db main directories.
        let rootdir = BOTS_HOME; // root text database directory
        let archive = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;       // directory to archive the data
        var dir = rootdir;      // temporary variable for some directory
        dir += '/' + archive;
        
        let filenames = fs.readdirSync(dir);
        
        for (let i = 0; i < filenames.length; i++) {
            let file = dir + '/' + filenames[i];
            fs.unlinkSync(file);
        }
        
        fs.rmdirSync(dir);
    }
    
    function _writeOrder(order, market) {
        console.bot("Time: " + (new Date()).toLocaleString() + "\n" + self.fixed.coin + "_" + self.fixed.high_market.name + "_" + self.fixed.low_market.name + "\nMessage: " + "WRITE ORDER >> " + self.dynamic.coin);
        let jsonObj = {
            id            : order.id,
            amount        : order.amount,
            total_cost    : order.total_cost,
            canceled_count: order.canceled_count
        };
        
        let data = JSON.stringify(jsonObj);
        
        // Do the file naming
        // The filename will be build from tree parts: today's date and the quarter
        //+of the day, as the information will be spread between four 6 hours' files
        //+and be put in the directories named after the year month and day.
        // For exaple: .../textdb/db/2017/8/30/30.08_quater_1.txt etc.
        
        // Create a function to check for a directory existance
        //+if there's no such directory, create one.
        
        // First manage the db main directories.
        let rootdir = BOTS_HOME; // root text database directory
        let archive = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;       // directory to archive the data
        var dir = rootdir;      // temporary variable for some directory
        create_unless_dir(dir); // create if there's
        
        dir += '/' + archive;
        create_unless_dir(dir);
        
        let filename   = 'order_' + market;
        
        let file       = dir + '/' + filename;
        
        fs.writeFileSync(file, data);
    }
    
    //TODO：FIX IF FILE IS EMPTY
    function _readOrder(market) {
        let rootdir = BOTS_HOME; // root text database directory
        let archive = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;
        var dir = rootdir;
        dir += '/' + archive;

        let filename = 'order_' + market;

        let file = dir + '/' + filename;
        if (fs.existsSync(file) != false) {
            // Try getting data.
            let data = fs.readFileSync(file);
            let json_obj = JSON.parse(data);
            
            if (json_obj.id == undefined) { json_obj.id = false; }
            
            return json_obj;
        }
        else {
            return { id: false, amount: undefined, total_cost: 0, canceled_count: 0 };
        }
    }
    
    function _unlinkOrder(market) {
        let rootdir = BOTS_HOME; // root text database directory
        let archive = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;
        var dir = rootdir;
        dir += '/' + archive;
        
        let filename   = 'order_' + market;
        
        let file       = dir + '/' + filename;
        
        if (fs.existsSync(file) != false) {
            fs.unlinkSync(file);
        }
    }
    
    function _writeFactor(market, cost, cur, prefix) {
        let factor_data = JSON.stringify({ cost: cost, cur: cur });
        
        prefix = ( (prefix === undefined) ? 'factor_' : prefix );
        
        // Do the file naming
        // The filename will be build from tree parts: today's date and the quarter
        //+of the day, as the information will be spread between four 6 hours' files
        //+and be put in the directories named after the year month and day.
        // For exaple: .../textdb/db/2017/8/30/30.08_quater_1.txt etc.
        
        // Create a function to check for a directory existance
        //+if there's no such directory, create one.

        // First manage the db main directories.
        let rootdir = BOTS_HOME; // root text database directory
        let archive = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;       // directory to archive the data
        var dir = rootdir;      // temporary variable for some directory
        create_unless_dir(dir); // create if there's
        
        dir += '/' + archive;
        create_unless_dir(dir);
        
        let factorname = prefix + market;
        
        let factorfile = dir + '/' + factorname;
        
        if (cost > 0) {
            fs.writeFileSync(factorfile, factor_data);
        }
    }
    
    function _unlinkFactor(market, prefix) {
        prefix = ( (prefix === undefined) ? 'factor_' : prefix );
        
        let rootdir = BOTS_HOME; // root text database directory
        let archive = 'bot-'+self.fixed.coin+'-'+self.fixed.high_market.name+'-'+self.fixed.low_market.name;
        var dir = rootdir;
        dir += '/' + archive;

        let factorname = prefix + market;

        let factorfile = dir + '/' + factorname;

        if (fs.existsSync(factorfile) != false) {
            fs.unlinkSync(factorfile);
        }
    }

    
    //console.log('Starting bot.');//TODO:REMOVE
    //while (results.length <= 0) { }
    self.update(500);
    // Start solving nonce problem. It is temporary salvation.
    //NOTE:FIXED. Nonce problem solved in start and monitor methods.
    self.start();
//    console.log(self);
}

//---------------------------------Constructor--------------------------------//

// AWAKE BOTS!
(function awake() {
    if (BOTS_MODE == true) {
        //console.log('No bots mode: [OFF].');
        // First manage the db main directories.
        let rootdir  = BOTS_HOME; // root text database directory
    
        if (fs.existsSync(rootdir) != false) {
            let archives = fs.readdirSync(rootdir);
            //console.log(archives);//TODO:REMOVE
        
            for (let i = 0; i < archives.length; i++) {
                let archive = archives[i];
                let dir = rootdir;      // temporary variable for some directory
                dir += '/' + archive;

                let filename = 'bot';

                let file = dir + '/' + filename;
                console.log(file);//TODO:REMOVE
                if (fs.existsSync(file) != false) {
                    //console.log('HI');//TODO:REMOVE
                
                    // Activate Bot
                    let data     = fs.readFileSync(file);
                    let json_obj = JSON.parse(data);
                    
                    let bot_args = {
                        dynamic_data: json_obj.dynamic,
                        fixed_data  : json_obj.fixed,
                        deal_amount : json_obj.amount,
                        bot_state   : json_obj.state,
                        market_state: json_obj.at,
                        is_active   : json_obj.active,
                        report      : json_obj.report,
                        queue_num   : json_obj.queue
                    };
                    new Bot(bot_args);
                }
                else {
                    //console.log('XУЙ');//TODO:REMOVE
                    fs.rmdirSync(dir);
                }
            }
        }
    }
    else {
        //console.log('No bots mode: [ON].');
    }
})();


// Extract JSON data from a file, that is
//+needed for the bot to work properly.
function getBotData(file) {
    try {
        // Try getting data.
        let data = fs.readFileSync(file);
        let json_obj = JSON.parse(data);

        return json_obj;
    }
    catch (e) {
        // Log an error message and disable the bots_mode (and may be simulate mode too).
        console.log("Error: JSON in '" + file + "' is damaged or missing.");
        if (BOTS_MODE === true) {
            BOTS_MODE = false;
            console.log("Bots mode was disabled.");
        }
        if (file === BOTDATA) {
            if (SIMULATE_BOTS === true) {
                SIMULATE_BOTS = false;
                console.log("Simulation mode was disabled.");
            }
            console.log("Run './configure botdata' to fix this issue.");
        }
        else if (file === LOTS) {
            console.log("You can run 'git pull' to download the working file from the web or fix it yourself.");
        }

        return {};
    }
}

// Save bot deals in textdb for one day near other data.
//+Format: [.../textdb/db/2017/9/3/03.09.deals].
// NOTE: Big part of this function was copied from <saveData(jsonObj)>.
function saveBotDeals(jsonObj) {
    // Parse JSON to string.
    let data = '';
    for (let i = 0; i < jsonObj.length; i++) {
        data += JSON.stringify(jsonObj[i]) + ",\n";
    }
    
    // First manage the db main directories.
    let rootdir = HISTORY_ROOT; // root text database directory
    let archive = 'db';       // directory to archive the data
    var dir = rootdir;      // temporary variable for some directory
    create_unless_dir(dir); // create if there's no such directory
   
    // Then the directories connected with the date.
    var now = new Date(); // generale date object
    let year = now.getFullYear().toString();
    let month = (now.getMonth() + 1).toString();
    let day = now.getDate().toString();

    // Create the directory path is there's no one.
    var arr = [ archive, year, month, day ];
    for (let s in arr) {
        dir += '/' + arr[s];
        create_unless_dir(dir);
    }

    // Solving the filename issue.
    // Set day and time to good looking format.
    if (month.length == 1)
        month = '0' + month;
    if (day.length == 1)
        day = '0' + day;
    // Calculate the quarter of the day.
    //let quarter_num = Math.floor(now.getUTCHours() / 6) + 1;
    let filename = day + '.' + month + '.deals';
    
    let file = dir + '/' + filename;
    let last = rootdir + '/last_deals.txt';
    let buffer = rootdir + '/.deals.txt';
    // Create file if there's no one.
    if (fs.existsSync(file) == false) {
        fs.writeFileSync(file, '');
    }
    if (fs.existsSync(buffer) == false) {
        fs.writeFileSync(buffer, '');
    }

    // Write data to the file.
    fs.appendFileSync(file, data);
    fs.appendFileSync(buffer, data);//TODO: Improve the code to not writing
                                    //+twice instead of copying a file.
}

function parse_deals(file, buffer) {
    
    fs.writeFileSync(file, ''); // For no repeat.
    if (fs.existsSync(buffer) == true) {
        fs.writeFileSync(file, fs.readFileSync(buffer));
    }
    
    fs.writeFileSync(buffer, '');
    
    let content = '';
    if (fs.existsSync(file) !== false) {
        let deals = fs.readFileSync(file);
        if (deals != "") {
            let body = deals;
            try {
                deals = '[' + deals.toString().substr(0, deals.toString().lastIndexOf(',')) + ']';
                deals = JSON.parse(deals);
                
                let profit = {
                    sum: { USD: 0, BTC: 0, ETH: 0, EUR: 0 }
                };
                let dirty_profit = {
                    sum: { USD: 0, BTC: 0, ETH: 0, EUR: 0 }
                };
                let count        = {
                    all  : deals.length,
                    plus : 0,
                    minus: 0,
                    sum  : { USD: 0, BTC: 0, ETH: 0, EUR: 0 }
                };
                let avg_time   = 0;
                let daily_cost = {
                    sum: { USD: 0, BTC: 0, ETH: 0, EUR: 0 }
                };
                let daily_average_cost = {
                    sum: { USD: 0, BTC: 0, ETH: 0, EUR: 0 }
                };
                let pairs = {};
                for (let i = 0; i < deals.length; i++) {
                    let obj = deals[i];
                    let cur = obj.open.coin.split('_')[0];
                    
                    // Count.
                    count.sum[cur] += 1;
                    obj.profit.min_profit < 0 ? count.minus++:count.plus++;
                    if (count[obj.open.sell_market] === undefined) {
                        count[obj.open.sell_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    count[obj.open.sell_market][cur] += 1;
                    if (count[obj.open.buy_market] === undefined) {
                        count[obj.open.buy_market] = { 
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    count[obj.open.buy_market][cur]  += 1;
                    
                    // Profit.
                    profit.sum[cur] += obj.profit.min_profit;
                    if (profit[obj.open.sell_market] === undefined) {
                        profit[obj.open.sell_market] = { 
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    profit[obj.open.sell_market][cur] += obj.open.real_sell_cost - obj.close.real_buy_cost - obj.open.max_sell_coms - obj.close.max_buy_coms;
                    if (profit[obj.open.buy_market] === undefined) {
                        profit[obj.open.buy_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    profit[obj.open.buy_market][cur] += obj.close.real_sell_cost - obj.open.real_buy_cost - obj.open.max_buy_coms - obj.close.max_sell_coms;
                    dirty_profit.sum[cur] += obj.profit.dirty_profit;
                    if (dirty_profit[obj.open.sell_market] === undefined) {
                        dirty_profit[obj.open.sell_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    dirty_profit[obj.open.sell_market][cur] += obj.open.real_sell_cost - obj.close.real_buy_cost;
                    if (dirty_profit[obj.open.buy_market] === undefined) {
                        dirty_profit[obj.open.buy_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    dirty_profit[obj.open.buy_market][cur] += obj.close.real_sell_cost - obj.open.real_buy_cost;
                    
                    // Cost.
                    daily_cost.sum[cur] += obj.open.real_sell_cost + obj.open.real_buy_cost + obj.close.real_sell_cost + obj.close.real_buy_cost;
                    if (daily_cost[obj.open.sell_market] === undefined) {
                        daily_cost[obj.open.sell_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    daily_cost[obj.open.sell_market][cur] += obj.open.real_sell_cost + obj.close.real_buy_cost;
                    if (daily_cost[obj.open.buy_market] === undefined) {
                        daily_cost[obj.open.buy_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    daily_cost[obj.open.buy_market][cur] += obj.open.real_buy_cost + obj.close.real_sell_cost;
                    daily_average_cost.sum[cur] += (obj.open.real_sell_cost + obj.open.real_buy_cost + obj.close.real_sell_cost + obj.close.real_buy_cost) / 4;
                    if (daily_average_cost[obj.open.sell_market] === undefined) {
                        daily_average_cost[obj.open.sell_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    daily_average_cost[obj.open.sell_market][cur] += (obj.open.real_sell_cost + obj.close.real_buy_cost) / 2;
                    if (daily_average_cost[obj.open.buy_market] === undefined) {
                        daily_average_cost[obj.open.buy_market] = {
                            USD: 0,
                            BTC: 0,
                            ETH: 0,
                            EUR: 0
                        };
                    }
                    daily_average_cost[obj.open.buy_market][cur] += (obj.open.real_buy_cost + obj.close.real_sell_cost) / 2;
                    
                    // Avg time.
                    function get_time(str) {
                        let arr = str.replace(/^(\d{4})\-(\d\d?)\-(\d\d?) (\d{2}):(\d{2}):(\d{2})/,'$1,$2,$3,$4,$5,$6').split(',');
                        for(let i = 0; i < arr.length; i++) {
                            arr[i] = Number(arr[i]);
                        }
                        return (new Date(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5]).getTime() / 1000);
                    }
                    
                    let time = (get_time(obj.close.date) - get_time(obj.open.date)) / 60;
                    avg_time += time;
                    
                    let id = obj.open.coin + '-' + obj.open.sell_market + '-' + obj.open.buy_market;
                    if (pairs[id] === undefined) {
                        pairs[id] = { name: id, count: 0, min_profit: 0, dirty_profit: 0, avg_time: 0 };
                    }
                    pairs[id].count        += 1;
                    pairs[id].min_profit   += obj.profit.min_profit;
                    pairs[id].dirty_profit += obj.profit.dirty_profit;
                    pairs[id].avg_time     += time;
                }
                avg_time = avg_time / count.all;
                
                // Average cost.
                for (let key in daily_average_cost) {
                    for (let cur in daily_average_cost[key]) {
                        daily_average_cost[key][cur] = daily_average_cost[key][cur] / count[key][cur];
                    }
                }
                
                let pairs_arr = [];
                for (let id in pairs) {
                    pairs[id].min_profit   = pairs[id].min_profit / pairs[id].count;
                    pairs[id].dirty_profit = pairs[id].dirty_profit / pairs[id].count;
                    pairs[id].avg_time     = pairs[id].avg_time / pairs[id].count;
                    
                    pairs_arr.push(pairs[id]);
                }
                
                pairs_arr.sort( function(a, b) { return b.count - a.count } );
                
                content = "Daily profit: " + JSON.stringify(profit, null, 1) + "\n" + "Daily dirty: " + JSON.stringify(dirty_profit, null, 1) + "\n" + "Daily total cost: " + JSON.stringify(daily_cost, null, 1) + "\n" + "Daily average cost: " + JSON.stringify(daily_average_cost, null, 1) + "\n" + "Count: " + JSON.stringify(count, null, 1) + "\n" + "Daily average time: " + avg_time + " min\n" + "\n" + "Info for each pair: " + JSON.stringify(pairs_arr, null, 1);
            }
            catch (e) {
                content = 'ERROR: ' + e + "\n" + body;
            }
        }
    }
    return content;
}

function getQueue(file) {
    let queue = 0;
    if (fs.existsSync(file) == true) {
        queue = Number(fs.readFileSync(file));
    }
    else {
        queue = 100001
    }

    if ( !(queue < 100000) ) { // For corrupted files.
        queue = 0;

        fs.writeFileSync(file, queue);
        console.log("'" + file + "' was generated, as it was absent, or queue number was over 100000.")
    }
    
    return queue;
}

function saveQueue(file, num) {
    try {
        fs.writeFileSync(file, num);
    }
    catch (e) {
        console.log("Save queue error. " + e);
        saveQueue(file, num);
    }
}

function giveQueue(arr) {
    while (arr.length > 0) {
        let bot = arr.shift();
        bot.queue = ++queue_num;
    }
    saveQueue(QUEUE, queue_num);
}

function getTriggers(file) {
    try {
        let now = new Date();
        let data = fs.readFileSync(file);
        let obj  = JSON.parse(data);
            
        obj.last_deals    = ((obj.last_deals !== undefined) ? new Date(obj.last_deals) : now);
        obj.balance_check = ((obj.balance_check !== undefined) ? new Date(obj.balance_check) : now);
        
        fs.writeFileSync(file, JSON.stringify(obj));
        
        return obj;
    }
    catch (e) {
        let now = new Date();
        let obj = {
            last_deals   : now,
            balance_check: now
        };

        fs.writeFileSync(file, JSON.stringify(obj));
        console.log("Generated '" + file + "' file, as it was absent or corrupted.");

        return obj;
    }
}

function writeTrigger(prop, val, file, obj) {
    obj = obj || triggers;
    
    obj[prop] = val;
    
    fs.writeFileSync(file, JSON.stringify(obj));
}


// Set 'wait or not' data to global botdata object.
//function setWaitBotData() {
//    let count = waitdata.length;
//    for (let i = 0; i < count; i++) {
//        let botdata_num = waitdata[i].botdata;
//        // Change the wait data.
//        botdata[botdata_num].wait = waitdata[i].wait;
//    }
//    return count;
//}

// Rewrite botdata file with new data.
//function saveWaitBotData(file) {
//    setWaitBotData();                       // First set botdata wait.
//    let textdata = JSON.stringify(botdata); // Then decode JSON.
//    fs.writeFileSync(file, textdata);       // And save data.
//}

///////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// BOT END ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

(async function main() {
    // Log time.
    let now = new Date();
    console.log(now.toLocaleString());
    // Get the data needed for the bot.
    botdata = getBotData(BOTDATA);
    lots    = getBotData(LOTS);
    if (SIMULATE_BOTS == true)
        simulate_waitdata = getSimulateWaitData(SIMULATE);
    // Reset global variables.
    coin_prices = {}, numberOfRequests = 0; results = []; //btcusd = {}; //waitdata = []; //botdeals = [];
    let arrayOfRequests = [];

    for (let i = 0; i < marketNames.length; i++) {
        let market = marketNames[i];
        arrayOfRequests.push(getMarketData(markets[market], coin_prices));
    }
    
    await Promise.all(arrayOfRequests.map(p => p.catch(e => e))) //TODO: Make better way to catch async errors/callbacks.
        .then(results => computePrices(coin_prices))
            .catch(e => console.log(e))
        .then(results => { if (results) activateBots() } );
    
    giveQueue(get_queue_arr);
    
    await simulateBots();
    
//    console.log(botdeals);
    if ( (HISTORY === true) && (results.length > 0) ) saveData(results);
    if (botdeals.length > 0) { saveBotDeals(botdeals); botdeals = []; }
    if (simulate_botdeals.length > 0) { 
        saveSimulateBotDeals(simulate_botdeals); simulate_botdeals = [];
        saveSimulateWaitBotData(SIMULATE, simulate_waitdata);
    }
    
    // 00:00 Tomorrow = last - time to 00:00 + 1 day.
    if (((triggers.last_deals.getTime() + 3600000 * 3 - (triggers.last_deals.getTime() + 3600000 * 3) % 86400000) + 86400000) < (now.getTime() + 3600000 * 3)) {
        let report = parse_deals(HISTORY_ROOT + '/last_deals.txt', HISTORY_ROOT + '/.deals.txt');
        
        if (report !== '') {
            send_mail({
                subject: 'Last deals. ' + now.toLocaleString(),
                content: report
            });
        }
        
        writeTrigger('last_deals', now, TRIGGERS);
    }
    
    setTimeout(main, 1500); //TODO: make good timer with actual min X sec
})();

// Needs: botdata, finance.
async function activateBots() {
//    console.log('ACTIVATE!');
    if (BOTS_MODE == true) {
        let markets = JSON.parse(JSON.stringify(markets_with_api)); // We need to accept only markets with api available.
        for (let j = 0; j < results.length; j++) {
            
            let curdeal = results[j];
            for (let i = 0; i < botdata.length; i++) {// botdata->global object.
                let deal = botdata[i];
                // If the deal is in botdata and markets have api.
                if ( (curdeal.coin === deal.coin) && (deal.wait !== 'none') && ( markets.includes(curdeal.high_market.name) && markets.includes(curdeal.low_market.name) && markets.includes(deal.high_market.name) && markets.includes(deal.low_market.name) ) ) {
                    
                    // Prepare.
                    
                    let market_state; // Indicator if found.
                    let coin;
                    let spread;
                    let high_market;
                    let low_market;
                    
                    // High.
                    if ((deal.high_market.name == curdeal.high_market.name)
                      &&(deal.low_market.name == curdeal.low_market.name)) {
                    
                        coin        = curdeal.coin;
                        spread      = curdeal.spread;
                        high_market = curdeal.high_market;
                        low_market  = curdeal.low_market;
                        
                        // Is high! //TODO:FIX wait: both --> strict.
                        if ((deal.wait != 'low')
                          &&(spread >= deal.spread_high)) {
                        
                            market_state = 'high';
                        }
                    }
                    // Low.
                    else if ((deal.high_market.name == curdeal.low_market.name)
                      &&(deal.low_market.name == curdeal.high_market.name)) {
                        
                        coin        = curdeal.coin;
                        spread      = curdeal.spread;
                        high_market = curdeal.low_market;  // Reverse.
                        low_market  = curdeal.high_market;
                        
                        // Is low!
                        if ((deal.wait != 'high')
                          &&(spread >= deal.spread_low)) {
                            
                            market_state = 'low';
                        }
                    }
                    else {
                        continue; //TODO:???
                    }
                    
                    // Activate.
                    
                   if (market_state != undefined) {
                        //Create an object for a bot.
                        let bot_args = {
                            dynamic_data: {
                                coin       : coin,
                                spread     : spread,
                                high_market: high_market,
                                low_market : low_market
                            },
                            fixed_data  : deal,
                            deal_amount : undefined,
                            bot_state   : 'start',
                            market_state: market_state,
                            is_active   : true,
                            report      : { open: {}, close: {}, profit: {} },
                            queue_num   : 'to_get'
                        };
                        
                        // Activate if not active.
                        let active_bot = BOTS_HOME + '/' + 'bot-'+bot_args.fixed_data.coin+'-'+bot_args.fixed_data.high_market.name+'-'+bot_args.fixed_data.low_market.name;
                        if (fs.existsSync(active_bot) == true) {
                            //break;
                        }
                        else {
                            console.log('ACTIVATE!', coin);//TODO:REMOVE
                            new Bot(bot_args);
                            //saveQueue(QUEUE, queue_num);
                            break;
                        }
                    }
                    else {
                        //break; //TODO:???
                    } 
                }
                // If it is not our deal, continue searching for it.
                else {
                    continue;
                }
            }
        }
    }
}

// Needs: botdata.
function simulateBots() {
    return new Promise(async function(resolve, reject) {
        if (SIMULATE_BOTS == true) {
            for (let j = 0; j < results.length; j++) {
                
                let curdeal = results[j];
                for (let i = 0; i < botdata.length; i++) {
                    let deal = botdata[i];
                    // If the deal is in botdata.
                    if (curdeal.coin == deal.coin) {
                        
                        // Prepare.
                        
                        let market_state; // Indicator if found.
                        let coin;
                        let spread;
                        let high_market;
                        let low_market;
                        
                        // High.
                        if ((deal.high_market.name == curdeal.high_market.name)
                          &&(deal.low_market.name == curdeal.low_market.name)) {
                        
                            coin        = curdeal.coin;
                            spread      = curdeal.spread;
                            high_market = curdeal.high_market;
                            low_market  = curdeal.low_market;
                            
                            var buy_market  = low_market;
                            var sell_market = high_market;
                            
                            var buy_ask  = buy_market.ask;
                            var sell_bid = sell_market.bid;
                            var wait     = 'low';
                            
                            if ((simulate_waitdata[coin + high_market.name
                                                 + low_market.name] != 'low')
                                 &&(spread >= deal.spread_high)) {
                            
                                market_state = 'high';
                            }
                        }
                        // Low.
                        else if ((deal.high_market.name == curdeal.low_market.name)
                          &&(deal.low_market.name == curdeal.high_market.name)) {
                        
                            coin        = curdeal.coin;
                            spread      = curdeal.spread;
                            high_market = curdeal.low_market;  // Reverse.
                            low_market  = curdeal.high_market;
                            
                            var buy_market  = high_market;
                            var sell_market = low_market;
    
                            var buy_ask  = buy_market.ask;
                            var sell_bid = sell_market.bid;
                            var wait     = 'high';
                            
                            // Is low!
                            if ((simulate_waitdata[coin + high_market.name
                                                    +  low_market.name] != 'high')
                              &&(spread >= deal.spread_low)) {
                                
                                market_state = 'low';
                            }
                        }
                        else {
                            continue; //TODO:???
                        }
                    
                        // Save data.
                        
                       if (market_state != undefined) {
                                console.log('SIMULATE', coin);//TODO:REMOVE
                                
                                // Change wait data.
                                simulate_waitdata[coin + high_market.name
                                                    +  low_market.name] = wait;
                                
                                let [ ob_buy, ob_sell ] = [ market_api[buy_market.name].get_orderbook(coin, 'buy'), market_api[sell_market.name].get_orderbook(coin, 'sell') ];
                                
                                let books = await Promise.all([ ob_buy, ob_sell ]);
                                
                                let [ buy_orderbook, sell_orderbook ] = [ books[0], books[1] ];
                                
                                buy_orderbook = JSON.stringify(buy_orderbook, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n");
                                sell_orderbook = JSON.stringify(sell_orderbook, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n")
                                
                                // SAVE RESULTS.
                                let now = (new Date()).toLocaleString();
                                let bot_deal = {
                                    date       : now,
                                    coin       : coin,
                                    spread     : spread,
                                    operation  : market_state,
                                    sell_market: sell_market.name,
                                    buy_market : buy_market.name,
                                    sell_price : sell_bid,
                                    buy_price  : buy_ask
                                };
                                
                                simulate_botdeals.push(bot_deal);
                                
                                // Mail if high.
                                //if (market_state == 'high') {
                                    send_mail({
                                        subject: 'SIMULATE on ' + market_state.toUpperCase() + ' ' + coin + " " + sell_market.name + " " + buy_market.name,
                                        content: JSON.stringify(bot_deal, null, 1) + "\n\n"
                                                + sell_market.name + " orderbook:" + "\n"
                                                + sell_orderbook + "\n"
                                                + buy_market.name + " orderbook:" + "\n"
                                                + buy_orderbook + "\n"
                                    });
                                //}
                            
                                break;
                        }
                        else {
                            //break; //TODO:???
                        } 
                    }
                    // If it is not our deal, continue searching for it.
                    else {
                        continue;
                    }
                }
            }
        }
    resolve(true);
    }); // Promise end.
}
