[![License: GPL v4](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

# gtarbitragec - cryptocurrency arbitrage master.
Advanced highly customizable asynchronous cryptocurrency arbitrage bot written for Node.js

## Usage

To start the program run:
```shell
npm start
```

Then open 'http://localhost:3001' in your favorite browser to monitor markets' spreads, for example:
```shell
firefox http://localhost:3001
```

Note that browser frontend do not include the bots' activity monitoring yet.

## Description

The whole idea of the program is to monitor difference between different cryptocurrency markets and hit it when it's big.
Simple math tells us, that if when the spread is high we sell on one market and buy on the other and reverse the operation when the spread is low (or high in the opposite direction) we just earn free money. (Not so free actually, considering the money freezing due to waiting for that situation to occur).

That said, dtarbitragec monitors markets set with './configure markets' command, activates bots based on strategy configured with './configure bot' and finance settings configured with './configure finance', using api keys stored through './configure keys', sending mail notifications from real or simulated bots configured via './configure mail' command and writes down monitored data to './textdb' local directory if the history mode is enabled using './configure modes' command.

Monitored data (spreads) is sent to localhost:3001 via socket interface; bots' progress is not - it is stored in './botV1' local directory instead.

## Getting started

dtarbitragec is written for Linux in the first place, but if you wish to run it under other platforms you can. At your own risk!

### Requirements

Node.js ^8.0.0, npm, bash/sh, curl, cat, sed, perl (optional).

Most of these is by default included in major Linux distributions, so you basically need to install nodejs/npm on your system.

If you wish to deploy on a Windows/other system, it is possible too, all you need is to install the software listed above first and may be do some magic after that.

### Installation

```shell
git clone https://github.com/dta90d/dtarbitragec.git
cd dtarbitragec
npm install
```

Installation script will guide you through the basic installation and configuration.

### Configuration and settings

All configuration files are written in JSON, so be aware of the syntax there.

Major configuration of the program is done via the configuration script.

```shell
./configure [-e <editor>] <command> [ARGS]
```

Settings (=commands) are divided into logical groups, including:
*    modes   -- enabling and disabling modes ('./configure modes').
*    bot     -- bots' strategy and triggers ('./configure bot').
*    markets -- enabling and disabling markets ('./configure markets').
*    finance -- bots' settings like order minimum and maximum cost ('./configure finance').
*    keys    -- your api keys from different markets ('./configure keys').
*    mail    -- mail notifications configuration ('./configure mail').

#### Modes

There are three modes available now:
*    bots\_mode           -- activate bots, that do financial operations based on strategy contained in botdata ('./configure bot') and static options in finance data ('./configure finance'), using api keys, contained in keys data ('./configure keys').
*    simulate\_bots       -- bots do not buy or sell really, so there's no need for finance and keys settings, but botdata is required still, as simulation is its test. These bots are simplier that real ones and applied only for testing if your strategy is reliable or not.
*    history             -- writes down all the monitored data to local directory ('./textdb'), that can be analyzed afterwards.

To configure modes simply run:
```shell
./configure modes
```

This will open configuration file and some instructions.

#### Bot (Perl required for configuration)

Bots' settings are called botdata. It can be configured dynamically even if the program is up and the bots are active. Newly configured data will apply only to future bots and won't disrupt the running ones.

Botdata is an array of cases telling bots whether to buy or sell or wait or whatever.

Basic structure of each bot (element in botdata array) is:
*   coin         -- pair/currency to watch for.
*   high\_market -- information about the market we suppose the bid to be higher than the other's ask.
*   low\_market  -- information about the market we suppose the ask to be lower than the other's bid.
*   spread\_high -- bid / ask (with a big difference).
*   spread\_low  -- bid / ask (with a small difference).
*   wait         -- when to open the deal an activate the bot - high, low, both or none.

An example of real botdata:
```JSON
[
    {
        "coin":"BTC_EOS",
        "high_market": {
            "lev":3,
            "name":"bitfinex",
            "step":0
        },
        "low_market": {
            "lev":3,
            "name":"hitbtc",
            "step":0
        },
        "spread_high":"0.9",
        "spread_low":"0.25",
        "wait":"high"
    },
    {
        "coin":"USD_XMR",
        "high_market": {
            "lev":3,
            "name":"kraken",
            "step":0
        },
        "low_market": {
            "lev":3,
            "name":"bittrex",
            "step":0
        },
        "spread_high":"1.2",
        "spread_low":"0.4",
        "wait":"low"
    }
]
```

To configure this settings run:
```shell
./configure bot
```
This will tell you how to use BotdataManager program to configure botadata on fly.

#### Markets (Perl required to configure)
You can tell the program is it needed to monitor the market or not.

Just run:
```shell
./configure markets
```
and turn on/off some of the markets in the configuration file. This will affect opened bots, as they won't be able to get the data from the markets.

#### Finance
Another peace of settings for the bot, but more static one:
*    min\_cost            -- set minimal cost for each order for each margin currency (USD, BTC, ETH, EUR).
*    max\_cost            -- set maximal cost for each order for each margin currency (USD, BTC, ETH, EUR).
*    balance\_buffer      -- buffer to remain on balance for each margin currency (USD, BTC, ETH, EUR).
*    amount\_mult         -- parameter to lower the amount attampting to buy/sell from the orderbook to guarantee the deal.
*    limit\_price\_buffer -- parameter to heighten/lower buy/sell price to guarantee the first ask/bid.
*    commission           -- your commission on each order for each market.

To configure these settings simply run:
```shell
./configure finance
```

An example of finance file:
```JSON
{
    "min_cost": { "USD": 10, "BTC": 0.0001, "ETH": 0.001, "EUR": 7  },
    "max_cost": { "USD": 20, "BTC": 0.0002, "ETH": 0.002, "EUR": 14 },
    "balance_buffer": { "USD": 100, "BTC": 0.001, "ETH": 0.01, "EUR": 70 },
    "amount_mult": 0.6,
    "limit_price_buffer": 0.8,
    "commission": {
        "bitfinex": 0.2,
        "kraken"  : 0.26,
        "hitbtc"  : 0.1,
        "bittrex" : 0.25,
        "poloniex": 0.25
    }
}
```

#### Keys
API keys configuration. Of course needed for the bots\_mode to work.

```shell
./configure keys
```

Example:
```JSON
{
    "bitfinex": {
        "key": "sdssdsd",
        "secret": "dsdsdjsijd"
    },

    "kraken": {
        "key": "sdsdsdsd",
        "secret": "dsdscsdcsdcsc"
    }
}
```

#### Mail
Mail notifications are available only via gmail service. Configure the outbox gmail and give the program its address and password. Note that you need to allow gmail to be used by the program.

```shell
./configure mail
```

Example (note that outbox address do not need the @gmail.com extention):
```JSON
{
    "enable" : true,
    "mail"   : "example",
    "pass"   : "123456really7",
    "SEND_TO": [
        "you@keemail.me",
        "yourbuddy@gmail.com"
    ]
}
```

## Contributing

Feel free to contact me at dta90d@keemail.me

## Authors

Written by **dta90d**

## License

See the [LICENSE.md](LICENSE.md) file for details
