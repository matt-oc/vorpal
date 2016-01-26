'use strict';

var _ = require('lodash');
var strip = require('strip-ansi');

var autocomplete = {

  /**
   * Handles tabbed autocompletion.
   *
   * - Initial tabbing lists all registered commands.
   * - Completes a command halfway typed.
   * - Recognizes options and lists all possible options.
   * - Recognizes option arguments and lists them.
   * - Supports cursor positions anywhere in the string.
   * - Supports piping.
   *
   * @param {String} str
   * @return {String} cb
   * @api public
   */

  exec: function (str, cb) {
    var self = this;
    var input = parseInput(str, this.parent.ui._activePrompt.screen.rl.cursor);
    var commands = getCommandNames(this.parent.commands);
    var vorpalMatch = getMatch(input.context, commands);

    function end(str) {
      var res = handleTabCounts.call(self, str);
      cb(undefined, res);
    }

    if (vorpalMatch) {
      input.context = vorpalMatch;
      end(assembleInput(input));
      return;
    }

    input = getMatchObject.call(this, input, commands);
    if (input.match) {
      input = parseMatchSection.call(this, input);
      getMatchData.call(self, input, function (data) {
        var dataMatch = getMatch(input.context, data);
        if (dataMatch) {
          input.context = dataMatch;
          end(assembleInput(input));
          return;
        }
        end(filterData(input.context, data));
      });
      return;
    }
    end(filterData(input.context, commands));
  },

  /**
   * Independent / stateless auto-complete function.
   * Parses an array of strings for the best match.
   *
   * @param {String} str
   * @param {Array} arr
   * @return {String}
   * @api private
   */

  match: function (str, arr) {
    arr = arr || [];
    arr.sort();
    var arrX = _.clone(arr);
    var strX = String(str);

    var go = function () {
      var matches = [];
      for (var i = 0; i < arrX.length; i++) {
        if (strip(arrX[i]).slice(0, strX.length).toLowerCase() === strX.toLowerCase()) {
          matches.push(arrX[i]);
        }
      }
      if (matches.length === 1) {
        return matches[0] + ' ';
      } else if (matches.length === 0) {
        return undefined;
      }
      var furthest = strX;
      for (var k = strX.length; k <= matches[0].length; ++k) {
        var curr = String(strip(matches[0]).slice(0, k)).toLowerCase();
        var same = 0;
        for (var j = 0; j < matches.length; ++j) {
          var sliced = String(strip(matches[j]).slice(0, curr.length)).toLowerCase();
          if (sliced === curr) {
            same++;
          }
        }
        if (same === matches.length) {
          furthest = curr;
          continue;
        } else {
          break;
        }
      }
      if (furthest !== strX) {
        return furthest;
      }
      return undefined;
    };
    return go();
  }
};

/**
 * Tracks how many times tab was pressed
 * based on whether the UI changed.
 *
 * @param {String} str
 * @return {String} result
 * @api private
 */

function handleTabCounts(str) {
  var result;
  if (_.isArray(str)) {
    this._tabCtr += 1;
    if (this._tabCtr > 1) {
      result = ((str.length === 0) ? undefined : str);
    }
  } else {
    this._tabCtr = 0;
    result = str;
  }
  return result;
}

/**
 * Looks for a potential exact match
 * based on given data.
 *
 * @param {String} ctx
 * @param {Array} data
 * @return {String}
 * @api private
 */

function getMatch(ctx, data) {
  // Look for a command match, eliminating and then
  // re-introducing leading spaces.
  var len = ctx.length;
  var trimmed = ctx.replace(/^\s+/g, '');
  var match = autocomplete.match(trimmed, data);
  var prefix = new Array((len - trimmed.length) + 1).join(' ');
  // If we get an autocomplete match on a command, finish it.
  if (match) {
    // Put the leading spaces back in.
    match = prefix + match;
    return match;
  }
  return undefined;
}

/**
 * Takes the input object and assembles
 * the final result to display on the screen.
 *
 * @param {Object} input
 * @return {String}
 * @api private
 */

function assembleInput(input) {
  var result =
    (input.prefix || '') +
    (input.context || '') +
    (input.suffix || '');
  return strip(result);
}

/**
 * Reduces an array of possible
 * matches to list based on a given
 * string.
 *
 * @param {String} str
 * @param {Array} data
 * @return {Array}
 * @api private
 */

function filterData(str, data) {
  data = data || [];
  var ctx = String(str || '').trim();
  var res = data.filter(function (item) {
    return (strip(item).slice(0, ctx.length) === ctx);
  });
  return res;
}

/**
 * Takes the user's current prompt
 * string and breaks it into its
 * integral parts for analysis and
 * modification.
 *
 * @param {String} str
 * @param {Integer} idx
 * @return {Object}
 * @api private
 */

function parseInput(str, idx) {
  var raw = String(str || '');
  var sliced = raw.slice(0, idx);
  var sections = sliced.split('|');
  var prefix = (sections.slice(0, sections.length - 1) || []);
  prefix.push('');
  prefix = prefix.join('|');
  var suffix = getSuffix(raw.slice(idx));
  var context = sections[sections.length - 1];
  return ({
    raw: raw,
    prefix: prefix,
    suffix: suffix,
    context: context
  });
}

/**
 * Takes the context after a
 * matched command and figures
 * out the applicable context,
 * including assigning its role
 * such as being an option
 * parameter, etc.
 *
 * @param {Object} input
 * @return {Object}
 * @api private
 */

function parseMatchSection(input) {
  var parts = (input.context || '').split(' ');
  var last = parts.pop();
  var beforeLast = strip(parts[parts.length - 1] || '').trim();
  if (beforeLast.slice(0, 1) === '-') {
    input.option = beforeLast;
  }
  input.context = last;
  input.prefix = (input.prefix || '') + parts.join(' ') + ' ';
  return input;
}

/**
 * Returns a cleaned up version of the
 * remaining text to the right of the cursor.
 *
 * @param {String} suffix
 * @return {String}
 * @api private
 */

function getSuffix(suffix) {
  suffix = (suffix.slice(0, 1) === ' ') ?
    suffix :
    suffix.replace(/.+?(?=\s)/, '');
  suffix = suffix.slice(1, suffix.length);
  return suffix;
}

/**
 * Compile all available commands and aliases
 * in alphabetical order.
 *
 * @param {Array} cmds
 * @return {Array}
 * @api private
 */

function getCommandNames(cmds) {
  var commands = _.map(cmds, '_name');
  commands = commands.concat.apply(commands, _.map(cmds, '_aliases'));
  commands.sort();
  return commands;
}

/**
 * When we know that we've
 * exceeded a known command, grab
 * on to that command and return it,
 * fixing the overall input context
 * at the same time.
 *
 * @param {Object} input
 * @param {Array} commands
 * @return {Object}
 * @api private
 */

function getMatchObject(input, commands) {
  var len = input.context.length;
  var trimmed = String(input.context).replace(/^\s+/g, '');
  var prefix = new Array((len - trimmed.length) + 1).join(' ');
  var match;
  var suffix;
  commands.forEach(function (cmd) {
    if (trimmed.substr(0, cmd.length) === cmd && String(cmd).trim() !== '') {
      match = cmd;
      suffix = trimmed.substr(cmd.length);
      prefix += trimmed.substr(0, cmd.length);
    }
  });

  var matchObject = (match) ?
    _.find(this.parent.commands, {_name: String(match).trim()}) :
    undefined;

  if (!matchObject) {
    this.parent.commands.forEach(function (cmd) {
      if ((cmd._aliases || []).indexOf(String(match).trim()) > -1) {
        matchObject = cmd;
      }
      return;
    });
  }

  if (!matchObject) {
    matchObject = _.find(this.parent.commands, {_catch: true});
    if (matchObject) {
      suffix = input.context;
    }
  }

  if (!matchObject) {
    prefix = input.context;
    suffix = '';
  }

  if (matchObject) {
    input.match = matchObject;
    input.prefix += prefix;
    input.context = suffix;
  }
  return input;
}

/**
 * Takes a known matched command, and reads
 * the applicable data by calling its autocompletion
 * instructions, whether it is the command's
 * autocompletion or one of its options.
 *
 * @param {Object} input
 * @param {Function} cb
 * @return {Array}
 * @api private
 */

function getMatchData(input, cb) {
  var self = this;
  var string = input.context;
  var cmd = input.match;
  var midOption = (String(string).trim().slice(0, 1) === '-');
  var afterOption = (input.option !== undefined);
  if (midOption === true) {
    var results = [];
    for (var i = 0; i < cmd.options.length; ++i) {
      var long = cmd.options[i].long;
      var short = cmd.options[i].short;
      if (!long && short) {
        results.push(short);
      } else if (long) {
        results.push(long);
      }
    }
    cb(results);
    return;
  }

  function handleDataFormat(str, config, callback) {
    var data = [];
    if (_.isArray(config)) {
      data = config;
    } else if (_.isFunction(config)) {
      var cbk = (config.length < 2) ? (function () {}) : (function (res) {
        callback(res || []);
      });
      var res = config.call(self, str, cbk);
      if (res && _.isFunction(res.then)) {
        res.then(function (resp) {
          callback(resp);
        }).catch(function (err) {
          callback(err);
        });
      } else if (config.length < 2) {
        callback(res);
      }
      return;
    }
    callback(data);
    return;
  }

  if (afterOption === true) {
    var opt = strip(input.option).trim();
    var shortMatch = _.find(cmd.options, {short: opt});
    var longMatch = _.find(cmd.options, {long: opt});
    var match = longMatch || shortMatch;
    if (match) {
      var config = match.autocomplete;
      handleDataFormat(string, config, cb);
      return;
    }
  }

  var conf = cmd._autocomplete;
  conf = (conf && conf.data) ? conf.data : conf;
  handleDataFormat(string, conf, cb);
  return;
}

module.exports = autocomplete;