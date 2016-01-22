/**
 * New module.
 */

var kafka = require('kafka-node'),
    Producer = kafka.Producer,
    serviceNowURLBase = 'https://it.epfl.ch/backoffice/api/now/v1/table/incident?sysparm_limit=20';



function requestWithCookies(url, done) {
    var request = require('request');
    var cookie = require('dunkatron-cookies');

    cookie.parse('/Users/dom/Dev/dojo/kafka/cookies.txt', function (err, jsonCookieObj) {
        request
            .get({
                url:url,
                jar:true,
                encoding:null,
                headers:{
                    Cookie:jsonCookieObj.getCookieString(url)
                }
            }, done)
    });
}

function getSomeTickets(query, done) {
    requestWithCookies(serviceNowURLBase + "&" + query, function (err, result, body) {
        if (err) {
            done(err, null);
        } else {
            done(null, JSON.parse(body));
        }
    });
}

getSomeTickets('sysparm_query=active=true', function (err, result) {
    console.log(JSON.stringify(result));

    var client = new kafka.Client("192.168.99.100:2181"), // connectionString: Zookeeper connection string, default localhost:2181/
        producer = new Producer(client),
        messages = result.result.map(function (ticket) {
            return ticket.number;
        });

    producer.on('ready', function () {
        console.log("Producer run ready");
        producer.send([{ topic: 'servicenow-tickets', messages: messages, partition: 0 }], function (err, data) {
            console.log(data + "SEND ERROR: " + err);
        });
    });

    producer.on('error', function (err) {console.log("KAFKA ERROR: " + err)});



});

