// market-settings.js
// Written by dta90d on 2017.11.25.
//
// Get the market data on bid/ask for every coin and market in the coin_dict file.

const fs = require('fs');

// Load coin names dictionary for each market.
const coin_dict = JSON.parse(fs.readFileSync('./data/coin_dict'));

let markets = {

    kraken: {
        marketName: 'kraken', // kraken has no one size fits all market summery so each pair has to be entered as param in GET - will need to add new coins as they are added to exchange
        URL: 'https://api.kraken.com/0/public/Ticker?pair='
             + ( coin_dict["kraken"] !== undefined ? Object.keys(coin_dict.kraken).join(',') : '' ), // URL To Fetch API From.
        
        last: function (data, coin_prices) { //Get the last price of coins in JSON data
            if (coin_dict["kraken"] !== undefined) {
                return new Promise(function (res, rej) {
                    try {
                        for (let key in data.result) {
                            
                            if (Object.keys(coin_dict.kraken).includes(key)
                                                                       == false) {
                                continue;
                            }
                            
                            // Translate kraken coin name.
                            let coin_name = coin_dict.kraken[key];
                            
                            if (coin_prices[coin_name] == undefined) {
                                coin_prices[coin_name] = {};
                            }
                            
                            coin_prices[coin_name].kraken = {
                                bid: Number(data.result[key].b[0]),
                                ask: Number(data.result[key].a[0])
                            };
    
                        }
                        res(coin_prices);
    
                    }
                    catch (err) {
                        console.log(err);
                        rej(err);
                    }
    
                })
            }
        }
    },
  
    bitfinex: {
        marketName: 'bitfinex',
        URL: 'https://api.bitfinex.com/v2/tickers?symbols='
             + ( coin_dict["bitfinex"] !== undefined ? Object.keys(coin_dict.bitfinex).join(',') : '' ),
        last: function (data, coin_prices) { //Where to find the last price of coin in JSON data
            if (coin_dict["bitfinex"] !== undefined) {
                return new Promise(function (res, rej) {
                    try {
                        for (let key_num in data) {
                            let key = data[key_num][0];
                            
                            if (Object.keys(coin_dict.bitfinex).includes(key)
                                                                       == false) {
                                continue;
                            }
                            
                            // Translate bitfinex coin name.
                            let coin_name = coin_dict.bitfinex[key];
                            
                            if (coin_prices[coin_name] == undefined) {
                                coin_prices[coin_name] = {};
                            }
                            
                            coin_prices[coin_name].bitfinex = {
                                bid: Number(data[key_num][1]),
                                ask: Number(data[key_num][3])
                            };
    
                        }
                        res(coin_prices);
                    }
                    catch (err) {
                        console.log(err);
                        rej(err);
                    }
    
                })
            }
        }
    },
    
    bittrex: {
        marketName: 'bittrex',
        URL: 'https://bittrex.com/api/v1.1/public/getmarketsummaries',
        last: function (data, coin_prices) { //Where to find the last price of coin in JSON data
            if (coin_dict["bittrex"] !== undefined) {
                return new Promise(function (res, rej) {
                    try {
                        for (let obj of data.result) {
                            let key = obj["MarketName"];
                            
                            if (Object.keys(coin_dict.bittrex).includes(key)
                                                                       == true) {
                                // Translate bittrex coin name.
                                let coin_name = coin_dict.bittrex[key];
                                
                                if (coin_prices[coin_name] == undefined) {
                                    coin_prices[coin_name] = {};
                                }
                                
                                coin_prices[coin_name].bittrex = {
                                    bid: Number(obj.Bid),
                                    ask: Number(obj.Ask)
                                };
                            }
                            if (Object.keys(coin_dict.bittrex_GO).includes(key)
                                                                       == true) {
                                // Translate bittrex coin name.
                                let coin_name = coin_dict.bittrex_GO[key];
                                
                                if (coin_prices[coin_name] == undefined) {
                                    coin_prices[coin_name] = {};
                                }
                                
                                coin_prices[coin_name].bittrex_GO = {
                                    bid: Number(obj.Bid),
                                    ask: Number(obj.Ask)
                                };
                            }
                        }
                        res(coin_prices);
                    }
                    catch (err) {
                        console.log(err);
                        rej(err);
                    }
    
                })
            }
        }
    },
    
    poloniex: {
        marketName: 'poloniex',
        URL: 'https://poloniex.com/public?command=returnTicker',
        last: function (data, coin_prices) { //Where to find the last price of coin in JSON data
            if (coin_dict["poloniex"] !== undefined) {
                return new Promise(function (res, rej) {
                    try {
                        for (var key in data) {
                            
                            if (Object.keys(coin_dict.poloniex).includes(key)
                                                                       == false) {
                                continue;
                            }
    
                            // Translate poloniex coin name.
                            let coin_name = coin_dict.poloniex[key];
    
                            if (coin_prices[coin_name] == undefined) {
                                coin_prices[coin_name] = {};
                            }
    
                            coin_prices[coin_name].poloniex = {
                                bid: Number(data[key].highestBid),
                                ask: Number(data[key].lowestAsk)
                            };
    
                        }
                        res(coin_prices);
                    }
                    catch (err) {
                        console.log(err);
                        rej(err);
                    }
    
                })
            }
        }
    },
    
    hitbtc: {
        marketName: 'hitbtc',
        URL: 'https://api.hitbtc.com/api/1/public/ticker/',
        last: function (data, coin_prices) { //Where to find the last price of coin in JSON data
            if (coin_dict["hitbtc"] !== undefined) {
                return new Promise(function (res, rej) {
                    try {
                        for (var key in data) {
                            
                            if (Object.keys(coin_dict.hitbtc).includes(key)
                                                                       == true) {
                                // Translate hitbtc coin name.
                                let coin_name = coin_dict.hitbtc[key];
        
                                if (coin_prices[coin_name] == undefined) {
                                    coin_prices[coin_name] = {};
                                }
        
                                coin_prices[coin_name].hitbtc = {
                                    bid: Number(data[key].bid),
                                    ask: Number(data[key].ask)
                                };
                            }
                            if (Object.keys(coin_dict.hitbtc_GO).includes(key)
                                                                       == true) {
                                // Translate hitbtc coin name.
                                let coin_name = coin_dict.hitbtc_GO[key];
                                
                                if (coin_prices[coin_name] == undefined) {
                                    coin_prices[coin_name] = {};
                                }
                                
                                coin_prices[coin_name].hitbtc_GO = {
                                    bid: Number(data[key].bid),
                                    ask: Number(data[key].ask)
                                };
                            }
                        }
                        res(coin_prices);
                    }
                    catch (err) {
                        console.log(err);
                        rej(err);
                    }
    
                })
            }
        }
    }
};

let marketNames = [];
let allMarkets  = Object.keys(markets);
for(let i = 0; i < allMarkets.length; i++) {
    let marketName = allMarkets[i];
    if (coin_dict[marketName] !== undefined) {
        marketNames.push([marketName]);
    }
}
console.log("Markets:", marketNames);
module.exports = function () {
    this.markets = markets;
    this.marketNames = marketNames;
    this.coin_dict = coin_dict;
};
