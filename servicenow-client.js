/**
 * ServiceNow client
 */
var assert = require("assert"),
    fs = require("fs"),
    _ = require("lodash"),
    moment = require('moment-timezone'),
    request = require('request'),
    Future = require('fibers/future'),
    cookie = require('dunkatron-cookies'),
    debug = require("debug")("servicenow-client");

var serviceNowURLBase = 'https://it.epfl.ch/backoffice/api/now/v1/table/incident';

/**
 * Construct a ServiceNow client object
 *
 * @param cookieFile Read authentication cookies from this file
 * @constructor
 */
function ServiceNowClient(cookieFile) {
    this.cookieFile = cookieFile;
}

module.exports = ServiceNowClient;

/**
 * Resume reading from this ticket state.
 *
 * The next call to fetch() will start returning ticket changes that immediately
 * follow this one.
 *
 * @param ticket
 */
ServiceNowClient.prototype.resume = function (ticket) {
    // TODO: fetch latest date and ticket numbers from ticket
};


/**
 * Return a well-ordered array of ticket states
 *
 * The result is a segment of a <b>well-ordered</b> of the list of ticket state
 * changes present in ServiceNow: calling fetch() several times return
 * back-to-back segments of that list, resuming from wherever the previous call
 * to resume() or fetch() left off, and eventually returns the empty list (when
 * at the end of ServiceNow's data stream).
 *
 * @param done Done callback
 */
ServiceNowClient.prototype.fetch = function (done) {
    var self = this;

    Future.task(function () {
        var cookies = self._getCookies(),
            queries = self._makeQueries();

        for (var ii = 0; ii < queries.length; ii++) {
            var query = queries[ii],
                url = serviceNowURLBase + "?sysparm_limit=200&" + query;
            debug("Query is now: " + query);
            var rawResult = Future.wrap(request.get, true)({
                    url: url,
                    jar: true,
                    encoding: null,
                    headers: {
                        Cookie: cookies.getCookieString(url)
                    }
                }).wait()[1],
                result = JSON.parse(rawResult);

            if (result.result) {
                debug(result.result.length + " results");
                self.lastSeenTicket = result.result[result.result.length - 1];
                return result.result;
            } else {
                debug("No results for query " + query);
            }
        }
        debug("No results for any of the " + queries.length + " queries");
        return [];
    }).resolve(done);
};

ServiceNowClient.prototype._getCookies = function () {
    if (! this.jsonCookieObj) {
        debug("No cookies yet");
        var exists = Future.wrap(function (path, done) {
            fs.exists(path, function (exists) { done(null, exists) });
        })(this.cookieFile).wait();
        assert(exists, this.cookieFile + " does not exist");
        this.jsonCookieObj = Future.wrap(cookie.parse)(this.cookieFile).wait();
    }
    return this.jsonCookieObj;
};

ServiceNowClient.prototype._makeQueries = function () {
    var lastSeenChange, lastSeenTicket;
    if (! this.lastSeenTicket) {
        // TODO: should really start from Genesis.
        lastSeenChange = moment().startOf("day");
    } else {
        lastSeenChange = moment.utc(this.lastSeenTicket.sys_updated_on);
        lastSeenTicket = this.lastSeenTicket.number;
    }

    function compareDateQuery(lastSeenChange, operator) {
        var lastChangeGMTSNow = lastSeenChange.format("YYYY-MM-DD HH:mm:ss");

        return "sys_updated_on" + operator +
            "javascript:GlideDateTime('"
            + lastChangeGMTSNow + "')";
    }

    function querify(sysparm_query) {
        return "sysparm_query=" + sysparm_query + "^ORDERBYsys_updated_on^ORDERBYnumber";
    }

    var queries = [querify(compareDateQuery(lastSeenChange, ">"))];

    if (lastSeenTicket) {
        queries.unshift(querify(compareDateQuery(lastSeenChange, "=") + "^number>" + lastSeenTicket))
    }
    return queries;
};
