// bot-settings.js
// Written by dta90d on 2017.11.25.
// 
// API settings for each market to give the bot.
//
// Private keys and secrets are stored in ./data/keys file.
// Example for ./data/keys :
// { "bitfinex": { "key": "sdsfvfv824f898fsvsfv", "secret": "sdfrf3f8498893498" }, "kraken": "key": "slow\?", "secret": "usable\?" }

const crypto  = require('crypto');  // For hashes and hmac's.
const request = require('request'); // For POSTing data.
const qs      = require('qs');      // FOR FUCKIN KRAKEN BODY!! FUCK>
const fs      = require('fs');      // For coin_dict and keys.

let e_json = "Error: there is a problem with api keys configuration. Run './configure keys' to fix this issue.\nBots mode is disabled.";

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\\
//.................................CONSTANTS..................................\\
//____________________________________________________________________________\\
const coin_dict = JSON.parse(fs.readFileSync('./data/coin_dict'));
const keys      = get_keys('./data/keys');

const ORDERBOOK_LIMIT = 50;

const BFX_API_KEY    = keys.bitfinex !== undefined ? keys.bitfinex.key : '';
const BFX_API_SECRET = keys.bitfinex !== undefined ? keys.bitfinex.secret : '';
const KRN_API_KEY    = keys.kraken !== undefined ? keys.kraken.key : '';
const KRN_API_SECRET = keys.kraken !== undefined ? keys.kraken.secret : '';
const HBC_API_KEY    = keys.hitbtc !== undefined ? keys.hitbtc.key : '';
const HBC_API_SECRET = keys.hitbtc !== undefined ? keys.hitbtc.secret : '';
const BTR_API_KEY    = keys.bittrex !== undefined ? keys.bittrex.key : '';
const BTR_API_SECRET = keys.bittrex !== undefined ? keys.bittrex.secret : '';
const PLN_API_KEY    = keys.poloniex !== undefined ? keys.poloniex.key : '';
const PLN_API_SECRET = keys.poloniex !== undefined ? keys.poloniex.secret : '';
//____________________________________________________________________________\\

function get_keys (file) {
    try {
        return JSON.parse(fs.readFileSync(file));
    }
    catch (e) {
        console.log(e_json + "\n", e);
        return {};
    }
}

console.test = function (msg) {
    let file = './log/' + (new Date()).toLocaleDateString() + ".status";
    if (fs.existsSync(file) == false) {
        fs.writeFileSync(file, "");
    }

    fs.appendFileSync(file, "\n\n" + msg);
}

console.orderbook = function (msg) {
    let file = './log/' + (new Date()).toLocaleDateString() + ".orderbook";
    if (fs.existsSync(file) == false) {
        fs.writeFileSync(file, "");
    }

    fs.appendFileSync(file, "\n\n" + msg);
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\\
//.................................FUNCTIONS..................................\\
//____________________________________________________________________________\\
let market_api = {
    
////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////// BITFINEX //////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
    bitfinex: {
        
        // Check balance.
        check_balance: function (cur_list) {
            
            // Request data.
            let method = 'margin_infos';
            let url = 'https://api.bitfinex.com/v1/' + method;
            let prepared = _BFX_prepare(method, {});
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url:     url,
                    method: 'POST',
                    headers: prepared.headers,
                    body:    prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    else {
                        try {
                            let buffer = ((JSON.parse(body))[0].margin_limits);
                            let result = {};
                            /*for (let obj_num in buffer) {
                                let pair = (coin_dict.bitfinex['t'+buffer[obj_num].on_pair]).split('_')[0];
                                if (pair == base) {
                                    result = Number(buffer[obj_num].tradable_balance);
                                    break;
                                }
                            }*/
                            result.USD = Number(buffer[0].tradable_balance);
                            
                            resolve(result);
                        }
                        catch (e) {
                            console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX error: ' + e + "\nBody:\n" + body);
                            resolve(false);
                        }
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Add order. Return order ID.
        add_order: function (coin, amount, price, side, lev) {
            // Constants.
            let type     = 'market';
            let ocoorder = false;
            
            let _coin   = _parse_coin(coin, 'bitfinex');
            let _amount = amount.toString();
            let _price  = price.toString();
            let _side   = side;
            
            let args = {
                symbol  : _coin,
                amount  : _amount,
                price   : _price,
                side    : _side,
                type    : type,
                ocoorder: ocoorder
            };
            
            // Request data.
            let method   = 'order/new';
            let url      = 'https://api.bitfinex.com/v1/' + method;
            let prepared = _BFX_prepare(method, args);
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body
                    //,timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    
                    try {
                        let result = (JSON.parse(body)).order_id;
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX add_order: ' + body);
                        if (result == undefined) { resolve(false); }
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Cancel order
        /*cancel_order: function (id) {
            // Request data.
            let method   = 'order/cancel';
            let url      = 'https://api.bitfinex.com/v1/order/cancel';
            let prepared = _BFX_prepare(method, { order_id: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let result = (JSON.parse(body));
                        resolve(result);
                    }
                    catch (e) {
                        console.error(e);
                        resolve(body.toString());
                    }
                }); //request end.
            }); //Promise end.
        },*/
        
        // Request order status.
        request_state: function (id) {
            // Request data.
            let method   = 'order/status';
            let url      = 'https://api.bitfinex.com/v1/' + method;
            let prepared = _BFX_prepare(method, { order_id: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    
                    try {
                        let buffer = JSON.parse(body);
                        
                        let state;
                        if (  (buffer.is_live      == false)
                            &&(buffer.is_cancelled == false)  ) {
                            
                            state = 'canceled';
                        }
                        else if (buffer.is_cancelled == true) {
                            state = 'canceled';
                        }
                        else {
                            state = 'opened';
                        }
                        
                        let result = {
                            id   : id,
                            state: state,
                            orig : Number(buffer.original_amount),
                            exec : Number(buffer.executed_amount),
                            price: Number(buffer.avg_execution_price)
                        };
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX request_state: ' + body);
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Get order book as an array to the needed side.
        get_orderbook(coin, side) {
            // Request data.
            let url = 'https://api.bitfinex.com/v1/book/';
            let _coin   = _parse_coin(coin, 'bitfinex');

            url += _coin;

            let _side    = ( side == 'buy' ? 'asks' : 'bids' );
            let opposite = ( (_side == 'asks') ? 'bids' : 'asks' );
            
            url += '?limit_' + _side + '=' + ORDERBOOK_LIMIT + '&limit_' + opposite + '=' + ORDERBOOK_LIMIT;
            
            console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX request ' + side + ' ' + coin + ' orderbook.');
            
            // Make request.
            return new Promise(function(resolve, reject) {

                request({
                    url,
                    method: 'GET',
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let buffer = JSON.parse(body);
                        let arr = buffer[_side];
                        let opt = buffer[opposite];
                        
                        let result = { result: [], optional: [] };
                        
                        for (let i = 0; i < arr.length; i++) {
                            result.result.push(
                                {
                                    price : Number(arr[i].price),
                                    amount: Number(arr[i].amount),
                                    time  : Number(arr[i].timestamp)
                                }
                            );
                        }
                        
                        for (let i = 0; i < opt.length; i++) {
                            result.optional.push(
                                {
                                    price : Number(opt[i].price),
                                    amount: Number(opt[i].amount),
                                    time  : Number(opt[i].timestamp)
                                }
                            );
                        }
                        
                        console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX response ' + side + ' ' + coin + ' orderbook:\n' + JSON.stringify(result, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n"));
                        
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITFINEX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        }
    
    }, //bitfinex end.


////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////// KRAKEN ////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
    
    kraken: {
        
        // Check balance. //TODO:NOTE Do not forget to multiply by leverage!!!
        check_balance: function (cur_list) {
            
            // Request data.
            let method = 'TradeBalance';
            let url = 'https://api.kraken.com/0/private/' + method;
            let prepared = _KRN_prepare(method, {});
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url,
                    method: 'POST',
                    headers: prepared.headers,
                    body:    prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    else {
                        try {
                            let result = {};
                            let error  = (JSON.parse(body)).error;
                            
                            result.USD = Number((JSON.parse(body)).result.mf);
                            
                            resolve(result);
                        }
                        catch (e) {
                            console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN error: ' + e + "\nBody:\n" + body);
                            resolve(false);
                        }
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Add order. Return order ID.
        add_order: function (coin, amount, price, side, lev) {
            // Constants.
            let ordertype = 'market';
            
            let _coin   = _parse_coin(coin, 'kraken');
            let _amount = Number(Number(amount).toFixed(8));
            let _price  = _KRN_prep_price(price, coin);
            let _side   = side;
            let _lev    = lev;
            let userref = parseInt((Math.random() * (2147483647 + 2147483648 + 1)), 10) - 2147483648;
            
            let args = {
                pair     : _coin,
                type     : _side,
                ordertype: ordertype,
                price    : _price,
                volume   : _amount,
                leverage : _lev,
                userref  : userref
            };
            
            // Request data.
            let method   = 'AddOrder';
            let url      = 'https://api.kraken.com/0/private/' + method;
            let prepared = _KRN_prepare(method, args);
            
            return new Promise(function(resolve, reject) {
               
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 60000
                }, async function(err, response, body) {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN add_order: ' + (err != null ? err : response.statusCode));
                        resolve((await _KRN_check_for_orders(userref, 10000, 12)));
                    }
                    else {
                        try {
                            let result = (JSON.parse(body)).result.txid[0];
                            let error  = (JSON.parse(body)).error;
                            console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN add_order: ' + body);
                            
                            resolve(result);
                        }
                        catch (e) {
                            console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN error: ' + e + "\nBody:\n" + body);
                            //if (body == '{"error":["EService:Unavailable"]}') {
                            //    resolve((await _KRN_check_for_orders(userref, 30000)));
                            //}
                            //else {
                                resolve(false);
                            //}
                        }
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Cancel order
        cancel_order: function (id) {
            
            // Request data.
            let method = 'CancelOrder';
            let url = 'https://api.kraken.com/0/private/CancelOrder';
            let prepared = _KRN_prepare(method, { txid: id });

            return new Promise(function(resolve, reject) {

                request({
                    url,
                    method: 'POST',
                    headers: prepared.headers,
                    body:    prepared.body,
                    timeout: 15000 
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)  
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));              
                        resolve(false);
                    }

                    try {
                        let result = JSON.parse(body);
                        resolve(result);
                    }
                    catch (e) {
                        console.error(e);
                        resolve(body.toString());
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Request order status.
        request_state: function (id) {
            
            // Request data.
            let method = 'QueryOrders';
            let url = 'https://api.kraken.com/0/private/' + method;
            let prepared = _KRN_prepare(method, { txid: id });

            return new Promise(function(resolve, reject) {

                request({
                    url,
                    method: 'POST',
                    headers: prepared.headers,
                    body:    prepared.body,
                    timeout: 15000 
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let buffer = (JSON.parse(body)).result[id];
                        
                        let state = (((buffer.status == 'open')
                                    ||(buffer.status == 'pending'))
                                 
                                  ? 'opened'
                                  : 'canceled');
                        
                        let result = {
                            id   : id,
                            state: state,
                            orig : Number(buffer.vol),
                            exec : Number(buffer.vol_exec),
                            price: Number(buffer.price)
                        };
                        let error  = (JSON.parse(body)).error;
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN request_state: ' + body);
                        if (error.length > 0) {
                            //console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN error: ' + error + "\nBody:\n" + body);
                            //resolve(false);
                        }
                        else {
                            resolve(result);
                        }
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Get order book as an array to the needed side.
        get_orderbook(coin, side) {
            // Request data.
            let url = 'https://api.kraken.com/0/public/Depth';
            let _coin   = _parse_coin(coin, 'kraken');
            
            url += '?pair=' + _coin;
            
            let _side = ( side == 'buy' ? 'asks' : 'bids' );
            let opposite = ( (_side == 'asks') ? 'bids' : 'asks' );
            
            url += '&count=' + ORDERBOOK_LIMIT;
            
            console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN request ' + side + ' ' + coin + ' orderbook.');
            
            // Make request.
            return new Promise(function(resolve, reject) {

                request({
                    url,
                    method: 'GET',
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let buffer = (JSON.parse(body)).result;
                        let arr = buffer[Object.keys(buffer)[0]][_side];
                        let opt = buffer[Object.keys(buffer)[0]][opposite];
                        
                        let result = { result: [], optional: [] };
                        
                        for (let i = 0; i < arr.length; i++) {
                            result.result.push(
                                {
                                    price : Number(arr[i][0]),
                                    amount: Number(arr[i][1]),
                                    time  : Number(arr[i][2])
                                }
                            );
                        }
                        
                        for (let i = 0; i < opt.length; i++) {
                            result.optional.push(
                                {
                                    price : Number(opt[i][0]),
                                    amount: Number(opt[i][1]),
                                    time  : Number(opt[i][2])
                                }
                            );
                        }
                        
                        console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN response ' + side + ' ' + coin + ' orderbook:\n' + JSON.stringify(result, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n"));
                        
                        let error  = (JSON.parse(body)).error;
                        if (error.length > 0) {
                            //console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN error: ' + e + "\nBody:\n" + body);
                            //resolve(false);
                        }
                        else {
                            resolve(result);
                        }
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        }
    
    }, // Kraken end



////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////// HITBTC ///////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
    hitbtc: {
        
        // Check balance.
        check_balance: function (cur_list) {
            
            // Request data.
            let method = 'balance->GET';
            let url = 'https://api.hitbtc.com';
            let prepared = _HBC_prepare(method, {});
            
            // For parsing.
            cur_list = _HBC_parse_curlist(cur_list);
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url + prepared.path,
                    method : 'GET',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    else {
                        try {
                            let buffer = (JSON.parse(body)).balance; // Array.
                            
                            let result = {};
                            for (let i = 0; i < buffer.length; i++) {
                                if (cur_list.includes(buffer[i].currency_code) == true) {
                                    let cur     = _HBC_from_cur(buffer[i].currency_code);
                                    result[cur] = Number(buffer[i].cash);
                                }
                            }
                            
                            if (Object.keys(result).length <= 0) {
                                resolve(false);
                            }
                            
                            resolve(result);
                        }
                        catch (e) {
                            console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC error: ' + e + "\nBody:\n" + body);
                            resolve(false);
                        }
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Add order. Return order ID.
        add_order: function (coin, amount, price, side, lev) {
            // Constants.
            let clientOrderId = _HBC_create_order_id();
            let type          = 'market';
            let timeInForce   = 'IOC';
            
            let _coin   = _parse_coin(coin, 'hitbtc');
            let _amount = amount;
            let _price  = price;
            let _side   = side;
            
            let args = {
                clientOrderId: clientOrderId,
                symbol       : _coin,
                quantity     : _amount,
                //price        : _price,
                side         : _side,
                type         : type,
                timeInForce  : timeInForce
            };
            
            // Request data.
            let method   = 'new_order->POST';
            let url      = 'https://api.hitbtc.com';
            let prepared = _HBC_prepare(method, args);
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url + prepared.path,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body
                    //,timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        //console.error(body);//TODO:REMOVE
                        resolve(false);
                    }
                    
                    try {
                        let buffer = (JSON.parse(body)).ExecutionReport;
                        let result = buffer.clientOrderId;
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC add_order: ' + body);
                        if (result == undefined) { resolve(false); }
                        if (buffer.orderStatus == "rejected") { resolve(false);}
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Cancel order
        cancel_order: function (id) {
            // Request data.
            let method   = 'order/cancel';
            let url      = 'https://api.bitfinex.com/v1/order/cancel';
            let prepared = _BFX_prepare(method, { order_id: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let result = (JSON.parse(body));
                        resolve(result);
                    }
                    catch (e) {
                        console.error(e);
                        resulve(body.toString());
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Request order status.
        request_state: function (id) {
            // Request data.
            let method   = 'order->GET';
            let url      = 'https://api.hitbtc.com';
            let prepared = _HBC_prepare(method, { clientOrderId: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url + prepared.path,
                    method :'GET',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        //console.error(body);//TODO:REMOVE
                        resolve(false);
                    }
                    
                    try {
                        let buffer = (JSON.parse(body)).orders[0];
                        
                        let state;
                        if (  (buffer.orderStatus == 'filled')
                            ||(buffer.orderStatus == 'expired')  ) {
                            
                            state = 'canceled'; // For order filled but not full
                        }
                        else if ((buffer.orderStatus == 'canceled')
                              || (buffer.orderStatus == 'rejected')) {
                            state = 'canceled';
                        }
                        else {
                            state = 'opened';
                        }
                        
                        let result = {
                            id   : id,
                            state: state,
                            orig : Number(buffer.orderQuantity),
                            exec : Number(buffer.orderQuantity) - Number(buffer.quantityLeaves),
                            price: Number(buffer.avgPrice)
                        };
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC request_state: ' + body);
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Get order book as an array to the needed side.
        get_orderbook(coin, side) {
            // Request data.
            let url = 'https://api.hitbtc.com/api/1/public/:symbol/orderbook?format_amount_unit=currency';
            let _coin   = _parse_coin(coin, 'hitbtc');
            
            url = url.replace(':symbol', _coin);
            
            let _side    = (side == 'buy' ? 'asks' : 'bids' );
            let opposite = ( (_side == 'asks') ? 'bids' : 'asks' );
            
            console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC request ' + side + ' ' + coin + ' orderbook.');
            
            // Make request.
            return new Promise(function(resolve, reject) {

                request({
                    url,
                    method: 'GET',
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let buffer = JSON.parse(body);
                        let arr = buffer[_side];
                        let opt = buffer[opposite];
                        let len = ORDERBOOK_LIMIT;
                        
                        let result = { result: [], optional: [] };
                        
                        for (let i = 0; (i < len)&&(i < arr.length); i++) {
                            result.result.push(
                                {
                                    price : Number(arr[i][0]),
                                    amount: Number(arr[i][1]),
                                    time  : undefined
                                }
                            );
                        }
                        
                        for (let i = 0; (i < len)&&(i < opt.length); i++) {
                            result.optional.push(
                                {
                                    price : Number(opt[i][0]),
                                    amount: Number(opt[i][1]),
                                    time  : undefined
                                }
                            );
                        }
                        
                        console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC response ' + side + ' ' + coin + ' orderbook:\n' + JSON.stringify(result, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n"));
                        
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'HITBTC error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        }
    
    }, //hitbtc end.


////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////// BITTREX //////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
    bittrex: {
        
        // Check balance.
        check_balance: function (cur_list) {
            
            // Request data.
            let method = 'account/getbalances';
            let url = '';
            
            // Prepare data.
            cur_list = _BTR_parse_curlist(cur_list);
            
            let prepared = _BTR_prepare(method, {});
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url + prepared.path,
                    method : 'GET',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    else {
                        try {
                            let buffer = (JSON.parse(body)).result;
                            let result = {};
                            
                            for (let i = 0; i < buffer.length; i++) {
                                if (cur_list.includes(buffer[i].Currency)) {
                                    let cur = _BTR_from_cur(buffer[i].Currency);
                                    result[cur] = Number(buffer[i].Available);
                                }
                            }
                            
                            if (Object.keys(result).length <= 0) {
                                resolve(false);
                            }
                            
                            resolve(result);
                        }
                        catch (e) {
                            console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX error: ' + e + "\nBody:\n" + body);
                            resolve(false);
                        }
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Add order. Return order ID.
        add_order: function (coin, amount, price, side, lev) {
            // Constants.
            //let type     = 'market'; // No market orders. Only limit.
            
            let _coin   = _parse_coin(coin, 'bittrex');
            let _amount = amount;
            let _price  = price;//(side == 'buy' ? price * 1.2 : price * 0.8);
            let _side   = side;
            
            let args = {
                market  : _coin,
                quantity: _amount,
                rate    : _price
            };
            
            // Request data.
            let method   = 'market/' + _side + 'limit';
            let url      = '';
            let prepared = _BTR_prepare(method, args);
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : prepared.path,
                    method :'GET',
                    headers: prepared.headers,
                    body   : prepared.body
                    //,timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    
                    try {
                        let buffer = JSON.parse(body);
                        let result = buffer.result.uuid;
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX add_order: ' + body);
                        if (result == undefined) { resolve(false); }
                        if (buffer.success == false) { resolve(false); }
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX error: ' + e + "Body:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Cancel order
        cancel_order: function (id) {
            // Request data.
            let method   = 'market/cancel';
            let url      = '';
            let prepared = _BTR_prepare(method, { uuid: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : prepared.path,
                    method :'GET',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let buffer = JSON.parse(body);
                        let result = buffer.success;
                        if (buffer.message == 'ORDER_NOT_OPEN') {
                            result = true;
                        }
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX cancel_order: ' + body);
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Request order status.
        request_state: function (id) {
            // Request data.
            let method   = 'account/getorder';
            let url      = '';
            let prepared = _BTR_prepare(method, { uuid: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : prepared.path,
                    method :'GET',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    
                    try {
                        let buffer = (JSON.parse(body)).result;
                        //console.log(buffer);//TODO:REMOVE
                        let state;
                        
                        if (buffer.CancelInitiated == true) {
                            state = 'canceled';
                        }
                        else if (buffer.Closed != null) {
                            state = 'canceled';
                        }
                        else {
                            state = 'opened';
                        }
                        
                        let result = {
                            id   : id,
                            state: state,
                            orig : Number(buffer.Quantity),
                            exec : Number(buffer.Quantity) - Number(buffer.QuantityRemaining),
                            price: Number(buffer.PricePerUnit)
                        };
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX request_state: ' + body);
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Get order book as an array to the needed side.
        get_orderbook(coin, side) {
            // Request data.
            let url = 'https://bittrex.com/api/v1.1/public/getorderbook?market=:symbol&type=both';
            let _coin   = _parse_coin(coin, 'bittrex');

            url = url.replace(':symbol', _coin);

            let _side    = ( side == 'buy' ? 'sell' : 'buy' );
            let opposite = side;
            
            console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX request ' + side + ' ' + coin + ' orderbook.');
            
            // Make request.
            return new Promise(function(resolve, reject) {

                request({
                    url,
                    method: 'GET',
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let buffer = (JSON.parse(body)).result;
                        let arr = buffer[_side];
                        let opt = buffer[opposite];
                        let len = ORDERBOOK_LIMIT;
                        
                        let result = { result: [], optional: [] };
                        
                        for (let i = 0; (i < len)&&(i < arr.length); i++) {
                            result.result.push(
                                {
                                    price : Number(arr[i].Rate),
                                    amount: Number(arr[i].Quantity),
                                    time  : undefined
                                }
                            );
                        }
                        
                        for (let i = 0; (i < len)&&(i < opt.length); i++) {
                            result.optional.push(
                                {
                                    price : Number(opt[i].Rate),
                                    amount: Number(opt[i].Quantity),
                                    time  : undefined
                                }
                            );
                        }
                        
                        console.orderbook("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX response ' + side + ' ' + coin + ' orderbook:\n' + JSON.stringify(result, null, 1).replace(/\n/g, "").replace(/},?/g, "},\n").replace(/\[/g, "[\n"));
                        
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'BITTREX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        }
    
    } //bittrex end.

/* NOTE: NOT TESTED
////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////// POLONIEX //////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
    poloniex: {
        
        // Check balance.
        check_balance: function (coin, lev) {
            
            // Request data.
            let method = 'returnBalances';
            let url = 'https://poloniex.com/tradingApi/' + method;
            
            let base = coin.split('_')[0];
            base = base === 'USD' ? 'USDT' : base;
            
            let prepared = _PLN_prepare(method, {});
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url:     url,
                    method: 'POST',
                    headers: prepared.headers,
                    body:    prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    
                    try {
                        let result = Number((JSON.parse(body)).base);
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'POLONIEX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Add order. Return order ID.
        add_order: function (coin, amount, price, side, lev) {
            // Constants.
            //let type     = 'market'; // Only limit.
            
            let _coin   = _parse_coin(coin, 'poloniex');
            let _amount = amount;
            let _price  = price;
            let _side   = side;
            
            let args = {
                currencyPair: _coin,
                amount      : _amount,
                rate        : _price
            };
            
            // Request data.
            let method   = _side;
            let url      = 'https://poloniex.com/tradingApi/' + method;
            let prepared = _PLN_prepare(method, args);
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body
                    //,timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    
                    try {
                        let result = JSON.parse(body);
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'POLONIEX add_order: ' + body);
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'POLONIEX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Cancel order
        cancel_order: function (id) {
            // Request data.
            let method   = 'order/cancel';
            let url      = 'https://api.bitfinex.com/v1/order/cancel';
            let prepared = _BFX_prepare(method, { order_id: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let result = (JSON.parse(body));
                        resolve(result);
                    }
                    catch (e) {
                        console.error(e);
                        resolve(body.toString());
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Request order status.
        request_state: function (id) {
            // Request data.
            let method   = 'returnOrderTrades';
            let url      = 'https://poloniex.com/tradingApi/' + method;
            let prepared = _PLN_prepare(method, { orderNumber: id });
            
            return new Promise(function(resolve, reject) {
                
                request({
                    url    : url,
                    method :'POST',
                    headers: prepared.headers,
                    body   : prepared.body,
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }
                    
                    try {
                        let result = JSON.parse(body);
                        
                        let state;
                        if (  (buffer.is_live     == false)
                            &&(buffer.is_canceled == false)  ) {
                            
                            state = 'closed';
                        }
                        else if (buffer.is_canceled == true) {
                            state = 'canceled';
                        }
                        else {
                            state = 'opened';
                        }
                        
                        let result = {
                            id   : id,
                            state: state,
                            orig : Number(buffer.original_amount),
                            exec : Number(buffer.executed_amount),
                            price: Number(buffer.avg_execution_price)
                        };
                        console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'POLONIEX request_state: ' + body);
                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'POLONIEX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        },
        
        // Get order book as an array to the needed side.
        get_orderbook(coin, side) {
            // Request data.
            let url = 'https://poloniex.com/public?command=returnOrderBook&currencyPair=';
            let _coin   = _parse_coin(coin, 'poloniex');

            url += _coin;

            let _side = ( side == 'buy' ? 'asks' : 'bids' );

            // Make request.
            return new Promise(function(resolve, reject) {

                request({
                    url,
                    method: 'GET',
                    timeout: 15000
                }, (err, response, body) => {
                    // If error.
                    if ( (err)
                       ||(  (response.statusCode !== 200)
                          &&(response.statusCode !== 400)  ) ) {
                        //TODO:IMPROVE
                        console.error(new Error(err != null ? err : response.statusCode));
                        resolve(false);
                    }

                    try {
                        let buffer = JSON.parse(body);
                        let arr = buffer[_side];

                        let result = [];

                        for (let i = 0; i < arr.length; i++) {
                            result.push(
                                {
                                    price : Number(arr[i][0]),
                                    amount: Number(arr[i][1]),
                                    time  : undefined
                                }
                            );
                        }

                        resolve(result);
                    }
                    catch (e) {
                        console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'POLONIEX error: ' + e + "\nBody:\n" + body);
                        resolve(false);
                    }
                }); //request end.
            }); //Promise end.
        }
    
    } //poloniex end.
*/
};


//////////////////////////////// HELP FUNCTIONS ////////////////////////////////

function _parse_coin(coiname, market) {
    let coin = coiname;
    for (let c in coin_dict[market]) {
        if (coin_dict[market][c] == coiname) {
            coin = c;
        }
    }
    if (coin == coiname) {
        market += '_GO';
    }
    
    for (let c in coin_dict[market]) {
        if (coin_dict[market][c] == coiname) {
            coin = c;
        }
    }
    
    // For bitfinex api v1.
    if (market == 'bitfinex') {
        coin = coin.replace('t', '');
    }
    return coin;
}

// Wait s seconds.
function wait(s) {
    return new Promise(function(resolve, reject) {
        setTimeout(resolve, s, true);
    });
}

function Nonce() {
    var self = this;
    let markets = Object.keys(market_api);
    function _get_nonce() {
        return JSON.stringify(Date.now() * 1000);
    }
    for (let i = 0; i < markets.length; i++) {
        let market = markets[i];
        self[market] = {
            nonce: 0,
            calc : function () {
                let to_try = _get_nonce();
                return self[market].nonce = to_try > self[market].nonce ? to_try : self[market].calc();
            }
        }
    }
}

const get_nonce = new Nonce();

////////////////////////////////////////////////////////////////////////////////
//////////////////////////// BITFINEX HELP FUNCTIONS ///////////////////////////
////////////////////////////////////////////////////////////////////////////////
function _BFX_prepare(method, params) {

    let nonce = get_nonce.bitfinex.calc();

    let body = {
        request: '/v1/' + method,
        nonce  : nonce
    };

    for (key in params) {
        value     = params[key];
        body[key] = value;
    }

    let payload   = new Buffer(JSON.stringify(body)).toString('base64');
    let signature = crypto.createHmac('sha384', BFX_API_SECRET).update(payload).digest('hex');

    let headers = {
        'X-BFX-APIKEY':    BFX_API_KEY,
        'X-BFX-PAYLOAD':   payload,
        'X-BFX-SIGNATURE': signature
    };
    
    let prepared = { headers: headers, body: JSON.stringify(body) };
    return prepared;
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
//////////////////////////// KRAKEN HELP FUNCTIONS /////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function _KRN_prepare(method, params) {

    let nonce = get_nonce.kraken.calc();
    //console.bot(nonce);//TODO:REMOVE
    
    let body = {
        nonce: nonce,
        otp:   undefined
    };
    
    for (key in params) {
        value     = params[key];
        body[key] = value;
    }
    
    // URI path + SHA256(nonce + POST data).
    let payload   = ('/0/private/' + method)
                   +(new crypto.createHash('sha256')
                               .update(nonce + qs.stringify(body))
                               .digest('binary')
                    );
    
    // Message signature using HMAC-SHA512 of
    //+payload and base64 decoded secret API key
    let signature = new crypto.createHmac(
                        'sha512', new Buffer(KRN_API_SECRET, 'base64')
                    )
                     .update(payload, 'binary')
                     .digest('base64');
    
    let headers = {
        'API-Key':  KRN_API_KEY,
        'API-Sign': signature
    };
    
    let prepared = { headers: headers, body: qs.stringify(body) };
    
    return prepared;
}


// Yes, price decimal number is different for different coins.
function _KRN_prep_price(price, coin) {
    let kraken_rules = {
        USD_BTC : 1,
        BTC_ETC : 6,
        USD_ETC : 3,
        BTC_ETH : 5,
        USD_ETH : 2,
        BTC_XMR : 6,
        USD_XMR : 2,
        BTC_REP : 6,
        ETH_ETC : 5,
        ETH_REP : 5,
        EUR_BTC : 1,
        EUR_ETC : 3,
        EUR_REP : 3,
        EUR_XMR : 2,
        USD_USDT: 4
    };
   
    let kraken_price = Number(Number(price).toFixed(kraken_rules[coin]));
    
    if (kraken_rules[coin] != undefined) {
        return kraken_price;
    }
    else {
        console.error(Error('Unhandled kraken price!!!'));
        return price;
    }
}

// Check for open and closed orders <times> times every <s> seconds.
async function _KRN_check_for_orders(userref, s, times) {
    if (s     === undefined) { s = 0; }
    if (times === undefined) { times = 1; }
    
    let id = false;
    for (let i = 0; i < times; i++) {
        // Wait s seconds.
        await wait(s);
        
        // Check open orders.
        do {
            id = await _KRN_get_orders(userref, 'open');
        } while (id == 'error');
        
        if (id === false) {
            // Check open orders.
            do {
                id = await _KRN_get_orders(userref, 'closed');
            } while (id == 'error');
        }
        
        if (id !== false) {
            break;
        }
    }
    return id;
}

// state = open / closed
function _KRN_get_orders(userref, state) {
    // Request data.
    let method = (state == 'open' ? 'OpenOrders' : 'ClosedOrders');
    let url = 'https://api.kraken.com/0/private/' + method;
    let prepared = _KRN_prepare(method, { userref: userref });
    
    return new Promise(function(resolve, reject) {
        request({
            url    : url,
            method :'POST',
            headers: prepared.headers,
            body   : prepared.body,
            timeout: 15000
        }, (err, response, body) => {
            // If error.
            if ( (err)
                ||(  (response.statusCode !== 200)
                &&(response.statusCode !== 400)  ) ) {
                //TODO:IMPROVE
                console.error(new Error(err != null ? err : response.statusCode));
                setTimeout(resolve, 300, 'error');
            }
            try {
                let buffer = (JSON.parse(body)).result;
                let error  = (JSON.parse(body)).error;
                let orders = Object.keys(buffer[state]);
                console.test("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN get_' + state + '_orders: ' + body);
                
                if (error.length > 0) {
                    setTimeout(resolve, 500, 'error');
                }
                else if (!(orders.length > 0)) {
                    setTimeout(resolve, 400, false);
                }
                else {
                    setTimeout(resolve, 1000, orders[0]);
                }
            }
            catch (e) {
                console.error("Time: " + (new Date()).toLocaleString() + "\n" + 'KRAKEN error: ' + e + "\nBody:\n" + body);
                setTimeout(resolve, 300, 'error');
            }
        }); //request end.
    }); // Promise end.
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
///////////////////////////// HITBTC HELP FUNCTIONS ////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function _HBC_prepare(method, params) {

    let nonce = get_nonce.hitbtc.calc();
    
    let m           = method.split('->');
    let http_method = m[1];
    method          = m[0];
    
    let path  = '/api/1/trading/' + method      + '?'
                      + 'apikey=' + HBC_API_KEY + '&'
                      + 'nonce='  + nonce;
    
    let body = {};

    for (key in params) {
        value     = params[key];
        body[key] = value;
    }
    
    if ((http_method == 'GET')&&(Object.keys(body).length > 0))
       path = path + '&' + qs.stringify(body);

    let payload   = http_method == 'GET' ? path : path + qs.stringify(body);
    let signature = crypto.createHmac('sha512', HBC_API_SECRET).update(payload).digest('hex');

    let headers = {
        'Api-Signature': signature
    };
    
    let prepared = { headers: headers, body: qs.stringify(body), path: path };
    return prepared;
}

function _HBC_create_order_id() {
    return crypto.randomBytes(14).toString('hex'); // 14*2-long string.
}

function _HBC_to_cur(curname) {
    let cur;

    let cursave;
    for (let key in coin_dict.hitbtc) {
        if ((coin_dict.hitbtc[key]).indexOf(curname) !== -1) {
            cursave = key;
            
            let second = key.replace(curname, '');
            if ((([ 'USD', 'BTC', 'ETH', 'EUR' ]).includes(curname) === true)||(([ 'USD', 'BTC', 'ETH', 'EUR' ]).includes(second) === true)) {
                cur = key.replace(second, '');
            }
            else {
                cur = false;
            }
            break;
        }
    }
    
    if (cur === cursave) {
        cur = false;
    }
    
    return cur;
}

function _HBC_from_cur(curname) {
    let cur;
    
    let cursave;
    for (let key in coin_dict.hitbtc) {
        if (key.indexOf(curname) !== -1) {
            cursave = coin_dict.hitbtc[key];
            
            let second = key.replace(curname, '');
            if ((([ 'USD', 'BTC', 'ETH', 'EUR' ]).includes(curname) === true)||(([ 'USD', 'BTC', 'ETH', 'EUR' ]).includes(second) === true)) {
                cur = coin_dict.hitbtc[key].replace(second, '').replace('_', '');
            }
            else {
                cur = false;
            }
            break;
        }
    }
    
    if (cur === cursave) {
        cur = false;
    }
    
    return cur;
}

function _HBC_parse_curlist(list) {
    let res = [];

    if (list !== undefined) {
        if (typeof(list) !== 'object') {
            list = [ list ];
        }
        
        for (let i = 0; i < list.length; i++) {
            let cur = _HBC_to_cur(list[i]);
            
            if ((cur !== false)&&(res.includes(cur) === false)) {
                res.push(cur);
            }
        }
    }
    else {
        res = [ 'USD', 'BTC', 'ETH', 'EUR' ];
        for (let key in coin_dict.hitbtc) {
            let cur = key.replace('USD', '').replace('BTC', '').replace('ETH', '').replace('EUR', '');
            
            if (res.includes(cur) === false) {
                res.push(cur);
            }
        }
    }
    
    return res;
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
///////////////////////////// BITTREX HELP FUNCTIONS ///////////////////////////
////////////////////////////////////////////////////////////////////////////////
function _BTR_prepare(method, params) {
    
    let nonce = get_nonce.bittrex.calc();
    let path  = 'https://bittrex.com/api/v1.1/' + method      + '?'
                                    + 'apikey=' + BTR_API_KEY + '&'
                                    + 'nonce='  + nonce;
    
    let body = {};

    for (key in params) {
        value     = params[key];
        body[key] = value;
    }
    if (Object.keys(body).length > 0) path = path + '&' + qs.stringify(body);
    
    let payload   = path;
    let signature = crypto.createHmac('sha512', BTR_API_SECRET).update(payload).digest('hex');

    let headers = {
        'apisign': signature
    };
    
    let prepared = { headers: headers, body: qs.stringify(body), path: path };
    return prepared;
}

function _BTR_to_cur(curname) {
    let cur;
    
    let curpos;
    for (let key in coin_dict.bittrex) {
        if ((coin_dict.bittrex[key]).indexOf(curname) !== -1) {
            cur    = key;
            curpos = ( ((coin_dict.bittrex[key]).indexOf(curname) > 0) ? 1 : 0 );
            break;
        }
    }
    
    if (cur !== undefined) {
        cur = cur.split('-')[curpos];
    }
    else {
        cur = false;
    }
    
    return cur;
}

function _BTR_from_cur(curname) {
    let cur;
    
    let curpos;
    for (let key in coin_dict.bittrex) {
        if (key.indexOf(curname) !== -1) {
            cur    = coin_dict.bittrex[key];
            curpos = ( (key.indexOf(curname) > 0) ? 1 : 0 );
            break;
        }
    }

    if (cur !== undefined) {
        cur = cur.split('_')[curpos];
    }
    else {
        cur = false;
    }
    
    return cur;
}

function _BTR_parse_curlist(list) {
    let res = [];
    
    if (list !== undefined) {
        if (typeof(list) !== 'object') {
            list = [ list ];
        }
        
        for (let i = 0; i < list.length; i++) {
            let cur = _BTR_to_cur(list[i]);
            
            if ((cur !== false)&&(res.includes(cur) === false)) {
                res.push(cur);
            }
        }
    }
    else {
        for (let key in coin_dict.bittrex) {
            let cur = key.split('-');
            
            if (res.includes(cur[0]) === false) {
                res.push(cur[0]);
            }
            if (res.includes(cur[1]) === false) {
                res.push(cur[1]);
            }
        }
    }
    
    return res;
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
//////////////////////////// POLONIEX HELP FUNCTIONS ///////////////////////////
////////////////////////////////////////////////////////////////////////////////
function _PLN_prepare(method, params) {

    let nonce = get_nonce.poloniex.calc();

    let body = {
        command: method,
        nonce  : nonce
    };

    for (key in params) {
        value     = params[key];
        body[key] = value;
    }

    let payload   = JSON.stringify(body);
    let signature = crypto.createHmac('sha512', PLN_API_SECRET).update(payload).digest('hex');

    let headers = {
        'Key':    PLN_API_KEY,
        'Sign':   signature
    };
    
    let prepared = { headers: headers, body: JSON.stringify(body) };
    return prepared;
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

//____________________________________________________________________________\\

module.exports = function () {
    this.market_api = market_api;
    this.markets_with_api = keys !== {} ? Object.keys(market_api) : [];
};
