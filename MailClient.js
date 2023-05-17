const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const nodemailer = require('nodemailer');
const readline = require('readline');
const stream = require('stream');
const fs = require('fs');
const path = require('path');
const MailNotifier = require('mail-notifier');





const imapConfig = {
    user: 'aaa@gmail.com',
    password: 'password',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: {
        rejectUnauthorized: false
    }
};
const pop3Config = {
    user: 'aaaa@gmail.com',
    password: 'password',
    host: 'pop.gmail.com',
    port: 995,
    tls: true,
    tlsOptions: {
        rejectUnauthorized: false
    }
};


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'aaaa@gmail.com',
        pass: 'password'
    }
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Connect to the IMAP server
const imap = new Imap(imapConfig);

function openInbox(cb) {
    if (imapConfig.host.includes('imap')) {
        imap.openBox('INBOX', true, cb);
    } else if (pop3Config.host.includes('pop')) {
        cb();
    } else {
        console.error('Invalid email protocol');
    }
}


function showEmails() {
    openInbox(function (err, box) {
        if (err) throw err;
        const fetchOptions = { bodies: '', struct: true };
        const fetch = imap.seq.fetch('1:' + box.messages.total, fetchOptions);
        fetch.on('message', function (msg, seqno) {
            msg.on('body', function (stream, info) {
                simpleParser(stream, (err, parsed) => {
                    if (err) {
                        console.error('Error parsing email:', err);
                        return;
                    }
                    console.log('----------------------');
                    console.log('Message ' + seqno + ':');
                    console.log('From:', parsed.from.text);
                    console.log('Subject:', parsed.subject);
                    console.log('Date:', parsed.date);
                    console.log('Text body:', parsed.text);
                    console.log('----------------------');

                    const attachments = parsed.attachments;
                    if (attachments && attachments.length > 0) {
                        console.log('Attachments:');
                        attachments.forEach((attachment, index) => {
                            console.log(index + 1 + '. ' + attachment.filename);
                        });
                    }

                    console.log('----------------------');

                    saveAttachments(parsed, function () {
                        // Callback after saving all attachments
                    });
                });
            });
        });
        fetch.on('end', function () {
            if (imapConfig.host.includes('imap')) {
                showMenu();
            } else if (pop3Config.host.includes('pop')) {
                pop3.quit();
            } else {
                console.error('Invalid email protocol');
            }
        });
        fetch.on('error', function (err) {
            console.error('Error fetching emails:', err);
        });
    });
}

function showEmailsPOP3() {
    const notifier = new MailNotifier({
        user: pop3Config.user,
        password: pop3Config.password,
        host: pop3Config.host,
        port: pop3Config.port,
        tls: pop3Config.tls,
        tlsOptions: pop3Config.tlsOptions,
        markSeen: false,
        fetchUnreadOnStart: true,
    });

    notifier.on('connected', function () {
        console.log('Connected to POP3 server');
    });

    notifier.on('mail', function (mail) {
        console.log('----------------------');
        console.log('From:', mail.from);
        console.log('Subject:', mail.subject);
        console.log('Date:', mail.date);
        console.log('Text body:', mail.text);
        console.log('----------------------');
    });

    notifier.on('end', function () {
        console.log('Disconnected from POP3 server');
        showMenu();
    });

    notifier.on('error', function (err) {
        console.error('Error connecting to POP3 server:', err);
    });

    notifier.start();
}





function saveAttachments(parsed, callback) {
    const attachments = parsed.attachments;

    if (!attachments || attachments.length === 0) {
        callback();
        return;
    }

    const savePath = '/Users/catalin/DATA/mail-client/attachments'; // Specify the desired save path here

    attachments.forEach((attachment, index) => {
        const filename = attachment.filename;
        const filePath = path.join(savePath, filename);

        if (attachment.content instanceof stream.Readable) {
            const fileStream = fs.createWriteStream(filePath);
            attachment.content.on('end', function () {
                fileStream.end();
                console.log('Attachment saved:', filePath);

                if (index === attachments.length - 1) {
                    callback();
                }
            });

            attachment.content.pipe(fileStream);
        } else {
            fs.writeFile(filePath, attachment.content, function (err) {
                if (err) {
                    console.log('Error saving attachment:', err);
                } else {
                    console.log('Attachment saved:', filePath);
                }

                if (index === attachments.length - 1) {
                    callback();
                }
            });
        }
    });
}


function sendEmail() {
    rl.question('To: ', function(to) {
        rl.question('Subject: ', function(subject) {
            rl.question('Message: ', function(message) {
                rl.question('Attachment path (leave empty if none): ', function(attachmentPath) {
                    const mailOptions = {
                        from: 'rusu1.catalin@gmail.com',
                        to: to,
                        subject: subject,
                        text: message,
                        attachments: []
                    };

                    if (attachmentPath) {
                        const attachment = {
                            filename: attachmentPath.split('/').pop(),
                            content: fs.createReadStream(attachmentPath)
                        };

                        mailOptions.attachments.push(attachment);
                    }

                    transporter.sendMail(mailOptions, function(error, info) {
                        if (error) {
                            console.log('Error occurred:', error);
                        } else {
                            console.log('Email sent:', info.response);
                        }
                        showMenu(); // Show the menu after sending the email
                    });
                });
            });
        });
    });
}




function showMenu() {
    rl.question('Enter "1" to send an email, "2" to show emails (IMAP), "3" to show emails (POP3): ', function(option) {
        if (option === '1') {
            sendEmail();
        } else if (option === '2') {
            imap.connect();
            imap.once('ready', function() {
                showEmails();
            });
        } else if (option === '3') {
            showEmailsPOP3();
        } else {
            console.log('Invalid option. Exiting...');
            rl.close();
        }
    });
}


// Main program
showMenu();




