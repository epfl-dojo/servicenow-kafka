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
    this.lastSeenChange = moment().startOf("day");
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
            query = self._makeQuery(),
            url = serviceNowURLBase + "?sysparm_limit=20&" + query;

        var rawResult = Future.wrap(request.get, true)({
                url: url,
                jar: true,
                encoding: null,
                headers: {
                    Cookie: cookies.getCookieString(url)
                }
            }).wait()[1],
            result = JSON.parse(rawResult);

        if (! result.result) {
            debug("No results in result");
            done(null, []);
            return [];
        }
        debug(result.result.length + " results in result");
        _.each(result.result, function (d) {
            var updatedDate = moment.utc(d.sys_updated_on);
            if (updatedDate.isAfter(self.lastSeenChange)) {
                self.lastSeenChange = updatedDate;
            }
        });
        return result.result;

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

ServiceNowClient.prototype._makeQuery = function () {
    // TODO: This code assumes that no two incidents have the same
    // sys_updated_on. Records will be skipped if that assumption is violated.
    // We should use a dual-key ordering with "number" (incident ID) as the
    // secondary key.
    var lastChangeGMTSNow = this.lastSeenChange.format("YYYY-MM-DD HH:mm:ss");
    return "sysparm_query=sys_updated_on>javascript:javascript:GlideDateTime('"
        + lastChangeGMTSNow + "')^ORDERBYsys_updated_on";
};


