// mail.js
// Written by dta90d on 2017.10.03.
//
// Mail notifications on any actions you need.
//
// Place your gmail with passwort and send_to list in ../data/mail.
//
// You can disable mail notifications by setting "on" properity to false.
//
// ../data/mail configurarion example: (Note: "out" mail is without "@gmail.com")
// { "enable": true, "mail": "out", "pass": "wowpass123", "SEND_TO": [ "friend@keemail.me", "enemy@gmail.com" ] }

const nodemailer = require('nodemailer');
const fs         = require('fs');

const f_mail = './data/mail';

// How-to use the function:
const m_help = "Usage: send_to( <Object> { subject: <string>, content: <string> }, <Array> SEND_TO )\n SEND_TO array is optional, the default values are stored in 'data/mail' file.";

// Default mail subject and content.
const d_subject = "Test mail from dtarbitragec.";
const d_content = "This is the default mail from dtarbitragec program.\n\n"
                 +"If you recived it, that means you did not configure the mail properly. Here's a small help for the send_to function:\n"
                 +m_help+"\n\n"
                 +"Hope, this helps!";

// Error message
const e_nofile = "Warning: Mail configuration is absent. Run './configure mail' to fix this issue.\nMail notifications are disabled.";
const e_json   = "Warning: Mail configuration has some problems. Run './configure mail' to fix this issue.\nMail notifications are disabled.";

let enable = false; // Disable by default.
let mail;         // Gmail address.
let pass;         // Gmail password.
let SEND_TO = []; // Global array of default sent_to emails. <Array String>.
let subject;
let content;

// Get email data.
if (fs.existsSync(f_mail) == true) {
    try {
        let data = fs.readFileSync(f_mail); // TODO: ADD E_HANDLER.
        let json = JSON.parse(data);
    
        enable  = json.enable  !== undefined ? json.enable  : enable;
        mail    = json.mail    !== undefined ? json.mail    : '';
        pass    = json.pass    !== undefined ? json.pass    : '';
        SEND_TO = json.SEND_TO !== undefined ? json.SEND_TO : SEND_TO;
    }
    catch (e) {
        console.log(e_json + "\n", e);
    }
}
else {
    console.log(e_nofile);
}

// Global variable that represent our email object.
const MAIL_BOT = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: mail,
        pass: pass
    }
});


// Function to send mail. send_mail(data_obj, <send_to_mail_arr> [opt]).
function send_mail(data_obj, send_to) {
    return new Promise(function(resolve, reject) {
        // Default destination emails.
        send_to = ( send_to || SEND_TO );

        // Default message.
        data_obj = ( data_obj || {} );
        subject = data_obj.subject !== undefined ? data_obj.subject : d_subject;
        content = data_obj.content !== undefined ? data_obj.content : d_content;
        
        if (typeof(send_to) === "array") send_to = send_to.join(', ');
        
        let options = {
            from   : mail,
            to     : send_to,
            subject: subject,
            text   : content
        };

        MAIL_BOT.sendMail(options, function(error, info){
            if (error) {
                 console.error(error);
                 console.log(m_help);
             }
             else {
                 //console.log('Email sent: ' + info.response);
             }
        });
    resolve(true);
    }); //Promise end.
}

module.exports = function () {
    this.send_mail = enable === true ? send_mail : function () { /* void */ } ;
};
