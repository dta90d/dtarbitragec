// simulate.js       
// Written by dta90d on 2017.10.03.
//
// Simulates bot activity without really buying or selling stuff.
// Writes data in temporary file ../data/simulate
// Controlled by SIMULATE_BOTS setting in dtarbitragec.js file.

const fs = require('fs');

// Extract JSON data from a file, that is
//+needed for the bot to work properly.
function getSimulateWaitData(file) {
    try {
        // Try getting data.
        if (fs.existsSync(file) == true) {
            let data = fs.readFileSync(file);
            let json_obj = JSON.parse(data);
            
            if (typeof(json_obj) !== "object") json_obj = {};
            
            return json_obj;
        }
        else {
            return {};
        }
    }
    catch (e) {
        
        console.log(e);
        fs.writeFileSync(file, '');
        
        return {};
    }
}

// Save bot deals in textdb for one day near other data.
//+Format: [.../textdb/db/2017/9/3/03.09.deals].
// NOTE: Big part of this function was copied from <saveData(jsonObj)>.
function saveSimulateBotDeals(jsonObj) {
    // Parse JSON to string.
    let data = JSON.stringify(jsonObj) + ",\n";
    
    // First manage the db main directories.
    let rootdir = './textdb'; // root text database directory
    let archive = 'db';       // directory to archive the data
    var dir = rootdir;      // temporary variable for some directory
    //create_unless_dir(dir); // create if there's no such directory
    
    // Then the directories connected with the date.
    var now = new Date(); // generale date object
    let year = now.getFullYear().toString();
    let month = (now.getMonth() + 1).toString();
    let day = now.getDate().toString();

    // Create the directory path is there's no one.
    var arr = [ archive, year, month, day ];
    for (let s in arr) {
        dir += '/' + arr[s];
        //create_unless_dir(dir);
    }

    // Solving the filename issue.
    // Set day and time to good looking format.
    if (month.length == 1)
        month = '0' + month;
    if (day.length == 1)
        day = '0' + day;
    // Calculate the quarter of the day.
    //let quarter_num = Math.floor(now.getUTCHours() / 6) + 1;
    let filename = day + '.' + month + '.simulate';
    
    let file = dir + '/' + filename;
    let last = rootdir + '/last_simulate.txt';
    let buffer = rootdir + '/.simulate.txt';
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
}

// Rewrite botdata file with new data.
function saveSimulateWaitBotData(file, simulate_waitdata) {
    let textdata = JSON.stringify(simulate_waitdata);
    fs.writeFileSync(file, textdata);
}

module.exports = function () {
    this.getSimulateWaitData     = getSimulateWaitData;
    this.saveSimulateWaitBotData = saveSimulateWaitBotData;
    this.saveSimulateBotDeals    = saveSimulateBotDeals;
};
