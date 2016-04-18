/**
 * Use servicenow-client.js from the command line.
 */

var _ = require("lodash"),
    Client = require('../servicenow-client'),
    client = new Client('/Users/dom/Downloads/cookies.txt');

function fetch() {
    client.fetch(function (error, values) {
        if (error) {
            console.log(error.stack);
        } else {
            console.log(JSON.stringify(_.map(values, function (v) {
                return {id: v.number, date: v.sys_updated_on};
            })));
            if (values.length > 0) fetch();
        }
    });
}

fetch();
