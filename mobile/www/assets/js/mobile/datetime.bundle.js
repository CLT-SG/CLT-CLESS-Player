var DateTimeBundle = (function () {
  'use strict';

  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _arrayWithoutHoles(r) {
    if (Array.isArray(r)) return _arrayLikeToArray(r);
  }
  function _assertThisInitialized(e) {
    if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return e;
  }
  function _callSuper(t, o, e) {
    return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e));
  }
  function _classCallCheck(a, n) {
    if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
  }
  function _defineProperties(e, r) {
    for (var t = 0; t < r.length; t++) {
      var o = r[t];
      o.enumerable = o.enumerable || false, o.configurable = true, "value" in o && (o.writable = true), Object.defineProperty(e, _toPropertyKey(o.key), o);
    }
  }
  function _createClass(e, r, t) {
    return r && _defineProperties(e.prototype, r), Object.defineProperty(e, "prototype", {
      writable: false
    }), e;
  }
  function _createForOfIteratorHelper(r, e) {
    var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (!t) {
      if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e) {
        t && (r = t);
        var n = 0,
          F = function () {};
        return {
          s: F,
          n: function () {
            return n >= r.length ? {
              done: true
            } : {
              done: false,
              value: r[n++]
            };
          },
          e: function (r) {
            throw r;
          },
          f: F
        };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var o,
      a = true,
      u = false;
    return {
      s: function () {
        t = t.call(r);
      },
      n: function () {
        var r = t.next();
        return a = r.done, r;
      },
      e: function (r) {
        u = true, o = r;
      },
      f: function () {
        try {
          a || null == t.return || t.return();
        } finally {
          if (u) throw o;
        }
      }
    };
  }
  function _defineProperty(e, r, t) {
    return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
      value: t,
      enumerable: true,
      configurable: true,
      writable: true
    }) : e[r] = t, e;
  }
  function _getPrototypeOf(t) {
    return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) {
      return t.__proto__ || Object.getPrototypeOf(t);
    }, _getPrototypeOf(t);
  }
  function _inherits(t, e) {
    if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function");
    t.prototype = Object.create(e && e.prototype, {
      constructor: {
        value: t,
        writable: true,
        configurable: true
      }
    }), Object.defineProperty(t, "prototype", {
      writable: false
    }), e && _setPrototypeOf(t, e);
  }
  function _isNativeReflectConstruct() {
    try {
      var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
    } catch (t) {}
    return (_isNativeReflectConstruct = function () {
      return !!t;
    })();
  }
  function _iterableToArray(r) {
    if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r);
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e,
        n,
        i,
        u,
        a = [],
        f = true,
        o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) ; else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
      } catch (r) {
        o = true, n = r;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function (r) {
        return Object.getOwnPropertyDescriptor(e, r).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread2(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), true).forEach(function (r) {
        _defineProperty(e, r, t[r]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
        Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
      });
    }
    return e;
  }
  function _possibleConstructorReturn(t, e) {
    if (e && ("object" == typeof e || "function" == typeof e)) return e;
    if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined");
    return _assertThisInitialized(t);
  }
  function _setPrototypeOf(t, e) {
    return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) {
      return t.__proto__ = e, t;
    }, _setPrototypeOf(t, e);
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _toConsumableArray(r) {
    return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread();
  }
  function _toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r);
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  function _toPropertyKey(t) {
    var i = _toPrimitive(t, "string");
    return "symbol" == typeof i ? i : i + "";
  }
  function _typeof(o) {
    "@babel/helpers - typeof";

    return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
      return typeof o;
    } : function (o) {
      return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
    }, _typeof(o);
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }

  /** @preserve Copyright (c) KNOWLEDGECODE - MIT License */
  var e = /\\\[/g,
    t = /\\\]/g,
    n = /\uE000/g,
    r = /\uE001/g,
    s = /\[(?:[^[\]]|\[[^[\]]*])*]|([A-Za-z])\1*|\.{3}|./g,
    o = function o(_o) {
      var a = _o.replace(e, "").replace(t, "").match(s) || [];
      return [_o].concat(_toConsumableArray(a.map(function (e) {
        return e.replace(n, "[").replace(r, "]");
      })));
    },
    a = new Map(),
    i = function i(e) {
      return a.get(e) || function () {
        var t = new Intl.DateTimeFormat("en-US", {
          hour12: false,
          weekday: "short",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          fractionalSecondDigits: 3,
          timeZone: e
        });
        return e && a.set(e, t), t;
      }();
    },
    c = function c(e, t) {
      if ("UTC" === (t === null || t === void 0 ? void 0 : t.toUpperCase())) return {
        weekday: e.getUTCDay(),
        year: e.getUTCFullYear(),
        month: e.getUTCMonth() + 1,
        day: e.getUTCDate(),
        hour: e.getUTCHours(),
        minute: e.getUTCMinutes(),
        second: e.getUTCSeconds(),
        fractionalSecond: e.getUTCMilliseconds(),
        timezoneOffset: 0
      };
      var n = i(t).formatToParts(e).reduce(function (e, _ref) {
        var t = _ref.type,
          n = _ref.value;
        switch (t) {
          case "weekday":
            e[t] = "SunMonTueWedThuFriSat".indexOf(n) / 3;
            break;
          case "hour":
            e[t] = +n % 24;
            break;
          case "year":
          case "month":
          case "day":
          case "minute":
          case "second":
          case "fractionalSecond":
            e[t] = +n;
        }
        return e;
      }, {
        weekday: 4,
        year: 1970,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        fractionalSecond: 0,
        timezoneOffset: 0
      });
      return n.timezoneOffset = (e.getTime() - Date.UTC(n.year, n.month - (n.year < 100 ? 22801 : 1), n.day, n.hour, n.minute, n.second, n.fractionalSecond)) / 6e4, n;
    },
    u = function u(e) {
      return Date.UTC(e.year, e.month - (e.year < 100 ? 22801 : 1), e.day, e.hour, e.minute, e.second, e.fractionalSecond + 6e4 * e.timezoneOffset);
    };
  var l = /*#__PURE__*/function () {
    function l(e, t) {
      _classCallCheck(this, l);
      this.parts = c(e, t), this.time = e.getTime();
    }
    return _createClass(l, [{
      key: "getFullYear",
      value: function getFullYear() {
        return this.parts.year;
      }
    }, {
      key: "getMonth",
      value: function getMonth() {
        return this.parts.month - 1;
      }
    }, {
      key: "getDate",
      value: function getDate() {
        return this.parts.day;
      }
    }, {
      key: "getHours",
      value: function getHours() {
        return this.parts.hour;
      }
    }, {
      key: "getMinutes",
      value: function getMinutes() {
        return this.parts.minute;
      }
    }, {
      key: "getSeconds",
      value: function getSeconds() {
        return this.parts.second;
      }
    }, {
      key: "getMilliseconds",
      value: function getMilliseconds() {
        return this.parts.fractionalSecond;
      }
    }, {
      key: "getDay",
      value: function getDay() {
        return this.parts.weekday;
      }
    }, {
      key: "getTime",
      value: function getTime() {
        return this.time;
      }
    }, {
      key: "getTimezoneOffset",
      value: function getTimezoneOffset() {
        return this.parts.timezoneOffset;
      }
    }]);
  }();
  var h = /*#__PURE__*/_createClass(function h() {
    _classCallCheck(this, h);
  });
  var d = function d(e, t) {
    return e.getFullYear() + ("buddhist" === t ? 543 : 0);
  };
  var m = new (/*#__PURE__*/function (_h) {
      function _class() {
        _classCallCheck(this, _class);
        return _callSuper(this, _class, arguments);
      }
      _inherits(_class, _h);
      return _createClass(_class, [{
        key: "YYYY",
        value: function YYYY(e, t) {
          return "000".concat(d(e, t.calendar)).slice(-4);
        }
      }, {
        key: "YY",
        value: function YY(e, t) {
          return "0".concat(d(e, t.calendar)).slice(-2);
        }
      }, {
        key: "Y",
        value: function Y(e, t) {
          return "".concat(d(e, t.calendar));
        }
      }, {
        key: "MMMM",
        value: function MMMM(e, t, n) {
          return t.locale.getMonthList({
            style: "long",
            compiledObj: n
          })[e.getMonth()] || "";
        }
      }, {
        key: "MMM",
        value: function MMM(e, t, n) {
          return t.locale.getMonthList({
            style: "short",
            compiledObj: n
          })[e.getMonth()] || "";
        }
      }, {
        key: "MM",
        value: function MM(e) {
          return "0".concat(e.getMonth() + 1).slice(-2);
        }
      }, {
        key: "M",
        value: function M(e) {
          return "".concat(e.getMonth() + 1);
        }
      }, {
        key: "DD",
        value: function DD(e) {
          return "0".concat(e.getDate()).slice(-2);
        }
      }, {
        key: "D",
        value: function D(e) {
          return "".concat(e.getDate());
        }
      }, {
        key: "HH",
        value: function HH(e, t) {
          return "0".concat(e.getHours() || ("h24" === t.hour24 ? 24 : 0)).slice(-2);
        }
      }, {
        key: "H",
        value: function H(e, t) {
          return "".concat(e.getHours() || ("h24" === t.hour24 ? 24 : 0));
        }
      }, {
        key: "AA",
        value: function AA(e, t, n) {
          return t.locale.getMeridiemList({
            style: "long",
            compiledObj: n,
            case: "uppercase"
          })[+(e.getHours() > 11)] || "";
        }
      }, {
        key: "A",
        value: function A(e, t, n) {
          return t.locale.getMeridiemList({
            style: "short",
            compiledObj: n,
            case: "uppercase"
          })[+(e.getHours() > 11)] || "";
        }
      }, {
        key: "aa",
        value: function aa(e, t, n) {
          return t.locale.getMeridiemList({
            style: "long",
            compiledObj: n,
            case: "lowercase"
          })[+(e.getHours() > 11)] || "";
        }
      }, {
        key: "a",
        value: function a(e, t, n) {
          return t.locale.getMeridiemList({
            style: "short",
            compiledObj: n,
            case: "lowercase"
          })[+(e.getHours() > 11)] || "";
        }
      }, {
        key: "hh",
        value: function hh(e, t) {
          return "0".concat(e.getHours() % 12 || ("h12" === t.hour12 ? 12 : 0)).slice(-2);
        }
      }, {
        key: "h",
        value: function h(e, t) {
          return "".concat(e.getHours() % 12 || ("h12" === t.hour12 ? 12 : 0));
        }
      }, {
        key: "mm",
        value: function mm(e) {
          return "0".concat(e.getMinutes()).slice(-2);
        }
      }, {
        key: "m",
        value: function m(e) {
          return "".concat(e.getMinutes());
        }
      }, {
        key: "ss",
        value: function ss(e) {
          return "0".concat(e.getSeconds()).slice(-2);
        }
      }, {
        key: "s",
        value: function s(e) {
          return "".concat(e.getSeconds());
        }
      }, {
        key: "SSS",
        value: function SSS(e) {
          return "00".concat(e.getMilliseconds()).slice(-3);
        }
      }, {
        key: "SS",
        value: function SS(e) {
          return "00".concat(e.getMilliseconds()).slice(-3, -1);
        }
      }, {
        key: "S",
        value: function S(e) {
          return "00".concat(e.getMilliseconds()).slice(-3, -2);
        }
      }, {
        key: "dddd",
        value: function dddd(e, t, n) {
          return t.locale.getDayOfWeekList({
            style: "long",
            compiledObj: n
          })[e.getDay()] || "";
        }
      }, {
        key: "ddd",
        value: function ddd(e, t, n) {
          return t.locale.getDayOfWeekList({
            style: "short",
            compiledObj: n
          })[e.getDay()] || "";
        }
      }, {
        key: "dd",
        value: function dd(e, t, n) {
          return t.locale.getDayOfWeekList({
            style: "narrow",
            compiledObj: n
          })[e.getDay()] || "";
        }
      }, {
        key: "Z",
        value: function Z(e) {
          var t = e.getTimezoneOffset(),
            n = Math.abs(t);
          return "".concat(t > 0 ? "-" : "+").concat(("0" + (n / 60 | 0)).slice(-2)).concat(("0" + n % 60).slice(-2));
        }
      }, {
        key: "ZZ",
        value: function ZZ(e) {
          var t = e.getTimezoneOffset(),
            n = Math.abs(t);
          return "".concat(t > 0 ? "-" : "+").concat(("0" + (n / 60 | 0)).slice(-2), ":").concat(("0" + n % 60).slice(-2));
        }
      }]);
    }(h))(),
    g = {
      MMMM: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      MMM: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      dddd: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      ddd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      dd: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      A: ["AM", "PM"],
      AA: ["A.M.", "P.M."],
      a: ["am", "pm"],
      aa: ["a.m.", "p.m."]
    };
  var M = new (/*#__PURE__*/function () {
      function _class2() {
        _classCallCheck(this, _class2);
      }
      return _createClass(_class2, [{
        key: "getLocale",
        value: function getLocale() {
          return "en";
        }
      }, {
        key: "getMonthList",
        value: function getMonthList(e) {
          return "long" === e.style ? g.MMMM : g.MMM;
        }
      }, {
        key: "getDayOfWeekList",
        value: function getDayOfWeekList(e) {
          return "long" === e.style ? g.dddd : "short" === e.style ? g.ddd : g.dd;
        }
      }, {
        key: "getMeridiemList",
        value: function getMeridiemList(e) {
          return "long" === e.style ? "lowercase" === e.case ? g.aa : g.AA : "lowercase" === e.case ? g.a : g.A;
        }
      }]);
    }())(),
    f = {
      encode: function encode(e) {
        return e;
      },
      decode: function decode(e) {
        return e;
      }
    };
  var y = function y(e) {
      return "object" == _typeof(e) && "zone_name" in e && "gmt_offset" in e;
    },
    D = function D(e) {
      return "UTC" === e;
    },
    p = function p(e, t) {
      var n = i("UTC"),
        r = i(t.zone_name),
        s = t.gmt_offset;
      for (var _t = 0; _t < 2; _t++) {
        var _o2 = n.format(e - 86400 * _t * 1e3);
        for (var _n = 0, _a = s.length; _n < _a; _n++) if (r.format(e - 1e3 * (s[_n] + 86400 * _t)) === _o2) return s[_n];
      }
      return NaN;
    },
    T = /^\[(.*)\]$/;
  function L(e, t, n) {
    var r = ("string" == typeof t ? o(t) : t).slice(1),
      s = y(n === null || n === void 0 ? void 0 : n.timeZone) || D(n === null || n === void 0 ? void 0 : n.timeZone) ? n.timeZone : void 0,
      a = "string" == typeof s ? s : (s === null || s === void 0 ? void 0 : s.zone_name) || "",
      i = a ? new l(e, a) : e,
      c = {
        hour12: (n === null || n === void 0 ? void 0 : n.hour12) || "h12",
        hour24: (n === null || n === void 0 ? void 0 : n.hour24) || "h23",
        numeral: (n === null || n === void 0 ? void 0 : n.numeral) || f,
        calendar: (n === null || n === void 0 ? void 0 : n.calendar) || "gregory",
        timeZone: s,
        locale: (n === null || n === void 0 ? void 0 : n.locale) || M
      },
      u = [].concat(_toConsumableArray((n === null || n === void 0 ? void 0 : n.plugins) || []), [m]),
      h = c.numeral.encode;
    return r.reduce(function (e, t) {
      return e + function (e, t) {
        var _iterator = _createForOfIteratorHelper(u),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var _n2 = _step.value;
            if (_n2[e]) return h(_n2[e](i, c, t));
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
        return T.test(e) ? e.replace(T, "$1") : e;
      }(t, r);
    }, "");
  }
  var C = /*#__PURE__*/_createClass(function C() {
    _classCallCheck(this, C);
  });
  var _S = function S(e, t, n) {
      var _e$exec;
      var r = ((_e$exec = e.exec(t)) === null || _e$exec === void 0 ? void 0 : _e$exec[0]) || "";
      return {
        value: +r,
        length: r.length,
        token: n
      };
    },
    w = function w(e, t, n) {
      return e.reduce(function (e, r, s) {
        return r.length > e.length && !t.indexOf(r) ? {
          value: s,
          length: r.length,
          token: n
        } : e;
      }, {
        value: -1,
        length: 0,
        token: n
      });
    };
  var b = new (/*#__PURE__*/function (_C) {
      function _class3() {
        _classCallCheck(this, _class3);
        return _callSuper(this, _class3, arguments);
      }
      _inherits(_class3, _C);
      return _createClass(_class3, [{
        key: "YYYY",
        value: function YYYY(e) {
          return _S(/^\d{4}/, e, "Y");
        }
      }, {
        key: "Y",
        value: function Y(e) {
          return _S(/^\d{1,4}/, e, "Y");
        }
      }, {
        key: "MMMM",
        value: function MMMM(e, t, n) {
          var r = t.locale.getMonthList({
              style: "long",
              compiledObj: n
            }),
            s = t.locale.getLocale(),
            o = t.ignoreCase ? w(r.map(function (e) {
              return e.toLocaleLowerCase(s);
            }), e.toLocaleLowerCase(s), "M") : w(r, e, "M");
          return o.value++, o;
        }
      }, {
        key: "MMM",
        value: function MMM(e, t, n) {
          var r = t.locale.getMonthList({
              style: "short",
              compiledObj: n
            }),
            s = t.locale.getLocale(),
            o = t.ignoreCase ? w(r.map(function (e) {
              return e.toLocaleLowerCase(s);
            }), e.toLocaleLowerCase(s), "M") : w(r, e, "M");
          return o.value++, o;
        }
      }, {
        key: "MM",
        value: function MM(e) {
          return _S(/^\d\d/, e, "M");
        }
      }, {
        key: "M",
        value: function M(e) {
          return _S(/^\d\d?/, e, "M");
        }
      }, {
        key: "DD",
        value: function DD(e) {
          return _S(/^\d\d/, e, "D");
        }
      }, {
        key: "D",
        value: function D(e) {
          return _S(/^\d\d?/, e, "D");
        }
      }, {
        key: "HH",
        value: function HH(e) {
          return _S(/^\d\d/, e, "H");
        }
      }, {
        key: "H",
        value: function H(e) {
          return _S(/^\d\d?/, e, "H");
        }
      }, {
        key: "AA",
        value: function AA(e, t, n) {
          var r = t.locale.getMeridiemList({
              style: "long",
              compiledObj: n,
              case: "uppercase"
            }),
            s = t.locale.getLocale();
          return t.ignoreCase ? w(r.map(function (e) {
            return e.toLocaleLowerCase(s);
          }), e.toLocaleLowerCase(s), "A") : w(r, e, "A");
        }
      }, {
        key: "A",
        value: function A(e, t, n) {
          var r = t.locale.getMeridiemList({
              style: "short",
              compiledObj: n,
              case: "uppercase"
            }),
            s = t.locale.getLocale();
          return t.ignoreCase ? w(r.map(function (e) {
            return e.toLocaleLowerCase(s);
          }), e.toLocaleLowerCase(s), "A") : w(r, e, "A");
        }
      }, {
        key: "aa",
        value: function aa(e, t, n) {
          var r = t.locale.getMeridiemList({
              style: "long",
              compiledObj: n,
              case: "lowercase"
            }),
            s = t.locale.getLocale();
          return t.ignoreCase ? w(r.map(function (e) {
            return e.toLocaleLowerCase(s);
          }), e.toLocaleLowerCase(s), "A") : w(r, e, "A");
        }
      }, {
        key: "a",
        value: function a(e, t, n) {
          var r = t.locale.getMeridiemList({
              style: "short",
              compiledObj: n,
              case: "lowercase"
            }),
            s = t.locale.getLocale();
          return t.ignoreCase ? w(r.map(function (e) {
            return e.toLocaleLowerCase(s);
          }), e.toLocaleLowerCase(s), "A") : w(r, e, "A");
        }
      }, {
        key: "hh",
        value: function hh(e) {
          return _S(/^\d\d/, e, "h");
        }
      }, {
        key: "h",
        value: function h(e) {
          return _S(/^\d\d?/, e, "h");
        }
      }, {
        key: "mm",
        value: function mm(e) {
          return _S(/^\d\d/, e, "m");
        }
      }, {
        key: "m",
        value: function m(e) {
          return _S(/^\d\d?/, e, "m");
        }
      }, {
        key: "ss",
        value: function ss(e) {
          return _S(/^\d\d/, e, "s");
        }
      }, {
        key: "s",
        value: function s(e) {
          return _S(/^\d\d?/, e, "s");
        }
      }, {
        key: "SSS",
        value: function SSS(e) {
          return _S(/^\d{1,3}/, e, "S");
        }
      }, {
        key: "SS",
        value: function SS(e) {
          var t = _S(/^\d\d?/, e, "S");
          return t.value *= 10, t;
        }
      }, {
        key: "S",
        value: function S(e) {
          var t = _S(/^\d/, e, "S");
          return t.value *= 100, t;
        }
      }, {
        key: "Z",
        value: function Z(e) {
          var t = _S(/^[+-][01]\d[0-5]\d/, e, "Z");
          return t.value = -60 * (t.value / 100 | 0) - t.value % 100, t;
        }
      }, {
        key: "ZZ",
        value: function ZZ(e) {
          var t = /^([+-][01]\d):([0-5]\d)/.exec(e) || ["", "", ""],
            n = +(t[1] + t[2]);
          return {
            value: -60 * (n / 100 | 0) - n % 100,
            length: t[0].length,
            token: "Z"
          };
        }
      }]);
    }(C))(),
    O = /^\[(.*)\]$/;
  function $(e, t, n) {
    var r = ("string" == typeof t ? o(t) : t).slice(1),
      s = {
        hour12: (n === null || n === void 0 ? void 0 : n.hour12) || "h12",
        hour24: (n === null || n === void 0 ? void 0 : n.hour24) || "h23",
        numeral: (n === null || n === void 0 ? void 0 : n.numeral) || f,
        calendar: (n === null || n === void 0 ? void 0 : n.calendar) || "gregory",
        ignoreCase: (n === null || n === void 0 ? void 0 : n.ignoreCase) || false,
        timeZone: y(n === null || n === void 0 ? void 0 : n.timeZone) || D(n === null || n === void 0 ? void 0 : n.timeZone) ? n.timeZone : void 0,
        locale: (n === null || n === void 0 ? void 0 : n.locale) || M
      },
      a = {
        _index: 0,
        _length: 0,
        _match: 0
      },
      i = [].concat(_toConsumableArray((n === null || n === void 0 ? void 0 : n.plugins) || []), [b]),
      c = function c(e, t) {
        var _iterator2 = _createForOfIteratorHelper(i),
          _step2;
        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var _n3 = _step2.value;
            if (_n3[e]) return _n3[e](t, s, r);
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
      };
    e = s.numeral.decode(e);
    var _iterator3 = _createForOfIteratorHelper(r),
      _step3;
    try {
      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
        var _t2 = _step3.value;
        var _n4 = e.substring(a._index),
          _r = c(_t2, _n4);
        if (_r) {
          if (!_r.length) break;
          _r.token && (a[_r.token] = _r.value + 0), a._index += _r.length, a._match++;
        } else if (_t2 === _n4[0] || " " === _t2) a._index++;else {
          if (!O.test(_t2) || _n4.indexOf(_t2.replace(O, "$1"))) {
            if ("..." === _t2) {
              a._index = e.length;
              break;
            }
            break;
          }
          a._index += _t2.length - 2;
        }
      }
    } catch (err) {
      _iterator3.e(err);
    } finally {
      _iterator3.f();
    }
    return a._length = e.length, a;
  }
  function v(e, t) {
    var n = void 0 === e.Y ? 1970 : e.Y - ("buddhist" === (t === null || t === void 0 ? void 0 : t.calendar) ? 543 : 0),
      _ref2 = "h11" === (t === null || t === void 0 ? void 0 : t.hour12) ? [0, 11] : [1, 12],
      _ref3 = _slicedToArray(_ref2, 2),
      r = _ref3[0],
      s = _ref3[1],
      _ref4 = "h24" === (t === null || t === void 0 ? void 0 : t.hour24) ? [1, 24] : [0, 23],
      _ref5 = _slicedToArray(_ref4, 2),
      o = _ref5[0],
      a = _ref5[1],
      i = function i(e, t, n) {
        return void 0 === e || e >= t && e <= n;
      };
    return e._index > 0 && e._length > 0 && e._index === e._length && e._match > 0 && i(n, 1, 9999) && i(e.M, 1, 12) && i(e.D, 1, (c = n, u = e.M || 1, new Date(c, u - (c < 100 ? 22800 : 0), 0).getDate())) && i(e.H, o, a) && i(e.A, 0, 1) && i(e.h, r, s) && i(e.m, 0, 59) && i(e.s, 0, 59) && i(e.S, 0, 999) && i(e.Z, -840, 720);
    var c, u;
  }
  function A(e, t, n) {
    return v($(e, t, n), n);
  }
  function U(e, t, n) {
    var r = $(e, t, n);
    if (!v(r, n)) return new Date(NaN);
    if (r.Y = r.Y ? r.Y - ("buddhist" === (n === null || n === void 0 ? void 0 : n.calendar) ? 543 : 0) : 1970, r.M = (r.M || 1) - (r.Y < 100 ? 22801 : 1), r.D || (r.D = 1), r.H = (r.H || 0) % 24 || 12 * (r.A || 0) + (r.h || 0) % 12, r.m || (r.m = 0), r.s || (r.s = 0), r.S || (r.S = 0), y(n === null || n === void 0 ? void 0 : n.timeZone)) {
      var _e = Date.UTC(r.Y, r.M, r.D, r.H, r.m, r.s, r.S),
        _t3 = p(_e, n.timeZone);
      return new Date(_e - 1e3 * _t3);
    }
    return D(n === null || n === void 0 ? void 0 : n.timeZone) || "Z" in r ? new Date(Date.UTC(r.Y, r.M, r.D, r.H, r.m + (r.Z || 0), r.s, r.S)) : new Date(r.Y, r.M, r.D, r.H, r.m, r.s, r.S);
  }
  function Y(e, t, n, r, s) {
    return L(U(e, t, r), n, s);
  }
  function H(e, t, n) {
    if (y(n)) {
      var _r2 = c(e, n.zone_name);
      _r2.month += t, _r2.timezoneOffset = 0;
      var _s = new Date(u(_r2));
      _s.getUTCDate() < _r2.day && _s.setUTCDate(0);
      var _o3 = u(_objectSpread2(_objectSpread2({}, _r2), {}, {
          year: _s.getUTCFullYear(),
          month: _s.getUTCMonth() + 1,
          day: _s.getUTCDate()
        })),
        _a2 = p(_o3, n);
      return new Date(_o3 - 1e3 * _a2);
    }
    var r = new Date(e.getTime());
    return D(n) ? (r.setUTCMonth(r.getUTCMonth() + t), r.getUTCDate() < e.getUTCDate() ? (r.setUTCDate(0), r) : r) : (r.setMonth(r.getMonth() + t), r.getDate() < e.getDate() ? (r.setDate(0), r) : r);
  }
  function Z(e, t, n) {
    return H(e, 12 * t, n);
  }
  function _(e, t, n) {
    if (y(n)) {
      var _r3 = c(e, n.zone_name);
      _r3.day += t, _r3.timezoneOffset = 0;
      var _s2 = u(_r3),
        _o4 = p(_s2, n);
      return new Date(_s2 - 1e3 * _o4);
    }
    var r = new Date(e.getTime());
    return D(n) ? (r.setUTCDate(r.getUTCDate() + t), r) : (r.setDate(r.getDate() + t), r);
  }
  function k(e, t) {
    return new Date(e.getTime() + 36e5 * t);
  }
  function j(e, t) {
    return new Date(e.getTime() + 6e4 * t);
  }
  function x(e, t) {
    return new Date(e.getTime() + 1e3 * t);
  }
  function z(e, t) {
    return new Date(e.getTime() + t);
  }
  var F = /^\[(.*)\]$/,
    P = function P(e, t) {
      return e.F = Math.trunc(1e6 * t), e;
    },
    W = function W(e, t) {
      return e.f = Math.trunc(1e3 * t), P(e, 1e3 * Math.abs(t) % 1 / 1e3);
    },
    N = function N(e, t) {
      return e.S = Math.trunc(t), W(e, Math.abs(t) % 1);
    },
    J = function J(e, t) {
      return e.s = Math.trunc(t / 1e3), N(e, Math.abs(t) % 1e3);
    },
    E = function E(e, t) {
      return e.m = Math.trunc(t / 6e4), J(e, Math.abs(t) % 6e4);
    },
    I = function I(e, t) {
      return e.H = Math.trunc(t / 36e5), E(e, Math.abs(t) % 36e5);
    },
    q = function q(e, t) {
      var n = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : f;
      var r = o(t).slice(1);
      return r.reduce(function (t, r) {
        return t + function (t) {
          if (t[0] in e) {
            var _e$t$;
            var _r4 = (_e$t$ = e[t[0]]) !== null && _e$t$ !== void 0 ? _e$t$ : 0;
            return n.encode("".concat(function (e) {
              return e < 0 || 0 === e && 1 / e == -1 / 0 ? "-" : "";
            }(_r4)).concat("".concat(Math.abs(_r4)).padStart(t.length, "0")));
          }
          return F.test(t) ? t.replace(F, "$1") : t;
        }(r);
      }, "");
    };
  var B = /*#__PURE__*/function () {
    function B(e) {
      _classCallCheck(this, B);
      this.time = e;
    }
    return _createClass(B, [{
      key: "toNanoseconds",
      value: function toNanoseconds() {
        var _this = this;
        return {
          value: 1e6 * this.time,
          format: function format(e, t) {
            return q(P({}, _this.time), e, t);
          },
          toParts: function toParts() {
            return {
              nanoseconds: Math.trunc(1e6 * _this.time) + 0
            };
          }
        };
      }
    }, {
      key: "toMicroseconds",
      value: function toMicroseconds() {
        var _this2 = this;
        return {
          value: 1e3 * this.time,
          format: function format(e, t) {
            return q(W({}, _this2.time), e, t);
          },
          toParts: function toParts() {
            return {
              microseconds: Math.trunc(1e3 * _this2.time) + 0,
              nanoseconds: Math.trunc(1e6 * _this2.time % 1e3) + 0
            };
          }
        };
      }
    }, {
      key: "toMilliseconds",
      value: function toMilliseconds() {
        var _this3 = this;
        return {
          value: this.time,
          format: function format(e, t) {
            return q(N({}, _this3.time), e, t);
          },
          toParts: function toParts() {
            return {
              milliseconds: Math.trunc(_this3.time) + 0,
              microseconds: Math.trunc(1e3 * _this3.time % 1e3) + 0,
              nanoseconds: Math.trunc(1e6 * _this3.time % 1e3) + 0
            };
          }
        };
      }
    }, {
      key: "toSeconds",
      value: function toSeconds() {
        var _this4 = this;
        return {
          value: this.time / 1e3,
          format: function format(e, t) {
            return q(J({}, _this4.time), e, t);
          },
          toParts: function toParts() {
            return {
              seconds: Math.trunc(_this4.time / 1e3) + 0,
              milliseconds: Math.trunc(_this4.time % 1e3) + 0,
              microseconds: Math.trunc(1e3 * _this4.time % 1e3) + 0,
              nanoseconds: Math.trunc(1e6 * _this4.time % 1e3) + 0
            };
          }
        };
      }
    }, {
      key: "toMinutes",
      value: function toMinutes() {
        var _this5 = this;
        return {
          value: this.time / 6e4,
          format: function format(e, t) {
            return q(E({}, _this5.time), e, t);
          },
          toParts: function toParts() {
            return {
              minutes: Math.trunc(_this5.time / 6e4) + 0,
              seconds: Math.trunc(_this5.time % 864e5 % 36e5 % 6e4 / 1e3) + 0,
              milliseconds: Math.trunc(_this5.time % 1e3) + 0,
              microseconds: Math.trunc(1e3 * _this5.time % 1e3) + 0,
              nanoseconds: Math.trunc(1e6 * _this5.time % 1e3) + 0
            };
          }
        };
      }
    }, {
      key: "toHours",
      value: function toHours() {
        var _this6 = this;
        return {
          value: this.time / 36e5,
          format: function format(e, t) {
            return q(I({}, _this6.time), e, t);
          },
          toParts: function toParts() {
            return {
              hours: Math.trunc(_this6.time / 36e5) + 0,
              minutes: Math.trunc(_this6.time % 864e5 % 36e5 / 6e4) + 0,
              seconds: Math.trunc(_this6.time % 864e5 % 36e5 % 6e4 / 1e3) + 0,
              milliseconds: Math.trunc(_this6.time % 1e3) + 0,
              microseconds: Math.trunc(1e3 * _this6.time % 1e3) + 0,
              nanoseconds: Math.trunc(1e6 * _this6.time % 1e3) + 0
            };
          }
        };
      }
    }, {
      key: "toDays",
      value: function toDays() {
        var _this7 = this;
        return {
          value: this.time / 864e5,
          format: function format(e, t) {
            return q((n = {}, r = _this7.time, n.D = Math.trunc(r / 864e5), I(n, Math.abs(r) % 864e5)), e, t);
            var n, r;
          },
          toParts: function toParts() {
            return {
              days: Math.trunc(_this7.time / 864e5) + 0,
              hours: Math.trunc(_this7.time % 864e5 / 36e5) + 0,
              minutes: Math.trunc(_this7.time % 864e5 % 36e5 / 6e4) + 0,
              seconds: Math.trunc(_this7.time % 864e5 % 36e5 % 6e4 / 1e3) + 0,
              milliseconds: Math.trunc(_this7.time % 1e3) + 0,
              microseconds: Math.trunc(1e3 * _this7.time % 1e3) + 0,
              nanoseconds: Math.trunc(1e6 * _this7.time % 1e3) + 0
            };
          }
        };
      }
    }]);
  }();
  var G = function G(e, t) {
      return new B(t.getTime() - e.getTime());
    },
    K = function K(e) {
      return !((e % 4 || !(e % 100)) && e % 400);
    },
    Q = function Q(e, t) {
      return e.toDateString() === t.toDateString();
    };

  var datetime = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Duration: B,
    addDays: _,
    addHours: k,
    addMilliseconds: z,
    addMinutes: j,
    addMonths: H,
    addSeconds: x,
    addYears: Z,
    compile: o,
    format: L,
    isLeapYear: K,
    isSameDay: Q,
    isValid: A,
    parse: U,
    preparse: $,
    subtract: G,
    transform: Y
  });

  /**
   * Date and Time Library Imports (v4.x)
   * 
   * This module imports the date-and-time library v4.x for mobile use.
   * Version 4.x uses named imports and has built-in support for most formats.
   */

  return datetime;

})();
//# sourceMappingURL=datetime.bundle.js.map
