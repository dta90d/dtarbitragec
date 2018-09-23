'use strict';

let checkedMarkets = {
        showAll: true,
    },
    checkedCoins = {
        showAll: false
    };

let addOne = true;

function addRemoveAll(coinsOrMarkets) {

    if (coinsOrMarkets === 'markets') {

        for (let market in checkedMarkets) {
            checkedMarkets[market] = !checkedMarkets.showAll;
            console.log(checkedMarkets[market]);
            addOne = false;
            addRemoveMarket(market);
            addOne = true;

        }
        useData();
    }

    if (coinsOrMarkets === 'coins') {

        for (let coin in checkedCoins) {
            checkedCoins[coin] = !checkedCoins.showAll;
            console.log(checkedCoins[coin]);
            addOne = false;
            addRemoveCoin(coin)
            addOne = true;

        }
        useData();
    }

}


function addRemoveCoin(coin) {
    if (addOne) checkedCoins[coin] = !checkedCoins[coin];

    if (checkedCoins[coin]) {
        $('#check-' + coin).addClass('fa-check-square-o');
        $('#check-' + coin).removeClass('fa-square-o');
    }
    else {
        $('#check-' + coin).removeClass('fa-check-square-o');
        $('#check-' + coin).addClass('fa-square-o');
    }

    if (addOne) useData();
}

function addRemoveMarket(market) {
    console.log("Trying to add/remove market")
    if (addOne){ console.log("If add one"); checkedMarkets[market] = !checkedMarkets[market] };

    if (checkedMarkets[market]) {
        console.log("If add one");
        $('#check-' + market).addClass('fa-check-square-o');
        $('#check-' + market).removeClass('fa-square-o');
    }
    else {
        $('#check-' + market).removeClass('fa-check-square-o');
        $('#check-' + market).addClass('fa-square-o')
    }

    if (addOne) useData();
}

function remove(item, highOrLow) {
    let li = $(item).closest('li');
    let coin = li.attr("data-coin");
    let market = li.attr("data-market1");
    if (!Array.isArray(checkedCoins[coin])) checkedCoins[coin]= [];
    checkedCoins[coin].push(market);
    console.log("Removing item...", checkedCoins[coin]);
    useData();
}

function searchMarketsOrCoins(marketOrCoin, input) {
    input = input.toUpperCase();
    let listItems = $('#' + marketOrCoin + '-list > li');

    if (input === "") {
        listItems.show();
    } else {
        listItems.each(function () {
            let text = $(this).text().toUpperCase();
            (text.indexOf(input) >= 0) ? $(this).show() : $(this).hide();
        });
    }


}

let useData;

$(window).load(function () {
    new WOW().init();

    $('.loader').hide();
    $('#header').show();


    let socket = io();

    let numberOfLoads = 0; //Number of final results loads
    let numberOfMLoads = 0; //Number of Market loadss


    socket.on('coinsAndMarkets', function (data) { //Function for when we get market data
        if (numberOfMLoads === 0) {  //Only  need to run this function once (Currently)
            let list = $('#market-list').empty(), coinList = $('#coin-list').empty();

            let marketSource = $("#market-list-template").html(); //Source
            let marketTemplate = Handlebars.compile(marketSource); // ^ and template for coin and market lists

            let coinSource = $("#coin-list-template").html(); //Source
            let coinTemplate = Handlebars.compile(coinSource); // ^ and template for coin and market lists

            let coinDataLen = data[1].length;
            for (let i = 0; i < coinDataLen; i++) { //Loop through coins
                let context = {coin: data[1][i]};
                let coin = context.coin;
                if (data[0][i]) {
                    context.market = data[0][i];
                    let market = context.market;
                    list.append(marketTemplate(context));
                    if (checkedMarkets[market] === false || checkedMarkets[market] === undefined) {
                        checkedMarkets[market] = false;
                        $('#check-' + market).removeClass('fa-check-square-o');
                        $('#check-' + market).addClass('fa-square-o');
                    }
                }

                coinList.append(coinTemplate(context));
                if (checkedCoins[coin] === undefined) checkedCoins[coin] = true;
                else {
                    $('#check-' + coin).removeClass('fa-check-square-o');
                    $('#check-' + coin).addClass('fa-square-o');
                }
            }
            for (let i = 0; i < data[0].length; i++) { // Check all markets by default. TODO: FIX
                let market = data[0][i];
                checkedMarkets[market] = true;
                $('#check-' + market).removeClass('fa-square-o')
                $('#check-' + market).addClass('fa-check-square-o');
            }
            numberOfMLoads++;
        }
    });

    let highest = $('#highest'); //Highest UL
    let highSource = $("#high-template").html(); //Template source
    let highTemplate = Handlebars.compile(highSource); //Template

    let bestSource = $("#best-template").html();
    let bestTemplate = Handlebars.compile(bestSource);

    var data;

    $('#coin-search').keyup(function () {
        let value = $(this).val();
        console.log(value);
        searchMarketsOrCoins("coin", value)
    });
    $('#market-search').keyup(function () {
        let value = $(this).val();
        searchMarketsOrCoins("market", value)
    });
 
    $('.loadNumberInput').change(function () {
        useData();
    });
    function allowedData(lowMarket, highMarket, coinName) {
        if(checkedMarkets[lowMarket] && checkedMarkets[highMarket] && checkedCoins[coinName]){
            if(Array.isArray(checkedCoins[coinName])) {
                if(!checkedCoins[coinName].includes(lowMarket) && !checkedCoins[coinName].includes(highMarket)) {
                    return true;
                }
                else return false;

            }
            else{
                return true;
            }
        }
        else {
            return false;
        }
    }

    useData = function () {

        console.log(data);
        let topN = $('.loadNumberInput').val();
        if (!topN) topN = data.length;
        let highestN = 1;
        let initN = 1;
        let dataLen = data.length;
        highest.empty();  //Remove any previous data (LI) from UL
        for (let i = dataLen - initN; i >= dataLen - topN; i--) { //Loop through top 10
            let highMarket = data[i].high_market.name, lowMarket = data[i].low_market.name, coinName = data[i].coin;
            // console.log(checkedCoins[coinName]);
            if (allowedData(lowMarket, highMarket, coinName)) {
                let context = { //All required data
                    coin: data[i].coin,
                    diff: data[i].spread.toFixed(3),
                    market2price: (data[i].low_market.ask * 1).toPrecision(5),
                    //Math.round(data[i].market2.last*10000)/10000,
                    market2: lowMarket,
                    market1price: (data[i].high_market.bid * 1).toPrecision(5),
                    /*function() {

                        let price = data[i].market1.last * Math.pow(10, 20);
                        for (let i = 20; i > 4; i--) { 
                            price = Math.round(price / 10);
                        }
                        return price;
                    },*/
                    /*function() {
                        let price = data[i].market1.last * 1;
                        for (let i = 10; i > 4; i--) {
                            let k = Math.pow(10, i);
                            price = Math.round(price * k) / k;
                        }
                        return price;
                    },*/
                    //(data[i].market1.last * 1).toPrecision(5),
                    market1: highMarket,
                    totalDiff: "TODO"//(((data[i].spread - 1) * 100) + ((data[pairIndex].spread - 1) * 100)).toFixed(2) //TODO: FIX
                };

                if (i === data.length - highestN) { //Add only the highest
                    $('.best-pair').empty();
                    let bestHTML = bestTemplate(context);
                    $('.best-pair').append(bestHTML);
                }


                let html = highTemplate(context);
                highest.append(html);
                console.log("Appending...")
            }

            else if (data.length - topN > 0) {
                topN++;
                highestN++;
            }
        }
    };

    let waitForMoreData;

    socket.on('results', function (results) {
        clearTimeout(waitForMoreData); //Every time we recieive new data clear the previous timeout so we don't loop through the data too many times unnecessarily...
        numberOfLoads++;
        if (numberOfLoads === 1) { //...unless we haven't loaded the data yet, then just run useData() immediately.
            $('.socket-loader').hide(); // Hide the preloader.gif
            $('#highest, #lowest').show(); //Show The UL
            data = results;
            useData();
        }

        else {
            waitForMoreData = setTimeout(function () {
                data = results;
                useData();
            }, 1000); //Wait a second before we run the function in case we get newer data within less than a second
        }

    });

});




