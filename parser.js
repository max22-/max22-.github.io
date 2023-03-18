function isLetter(c) {
    return c.toLowerCase() != c.toUpperCase();
}

function sat(f) {
    return (line, idx) => {
        if(idx >= line.length) return null;
        c = line[idx];
        if(f(c)) return {"value": c, "start": idx, "end": idx + 1};
        else return null;
    }
}

var letter = sat(c => isLetter(c) && c != 'λ');
var digit = sat(c => c >= '0' && c <= '9');
var char = x => sat(c => c == x)

function fby(p1, p2) {
    return (line, idx) => {
        var ret1 = p1(line, idx);
        if(ret1 == null) return null;
        ret2 = p2(line, ret1.end);
        if(ret2 == null) return null;
        return {"value": [ret1.value, ret2.value], "start":idx, "end":ret2.end};
    }
}

function seq(ps) {
    return (line, idx) => {
        var val = [];
        var tidx = idx;
        for(var i = 0; i < ps.length; i++) {
            var p = ps[i];
            var ret = p(line, tidx);
            if(ret == null) return null;
            val.push(ret.value);
            tidx = ret.end;
        };
        return {"value": val, "start": idx, "end": tidx};
    }
}

function maybe(p) {
    return (line, idx) => {
        var ret = p(line, idx);
        if(ret == null) return {"value": "", "start":idx, "end": idx};
        else return ret;
    }
}

function choice(ps) {
    return (line, idx) => {
        for(var i = 0; i < ps.length; i++) {
            var p = ps[i];
            var ret = p(line, idx);
            if(ret != null) return ret;
        };
        return null;
    }
}

function variable(line, idx) {
    var ret = fby(letter, maybe(digit))(line, idx);
    if(ret == null) return null;
    ret.value = {"type": "var", "name": ret.value[0] + ret.value[1]};
    return ret;
}

function lambda(line, idx) {
    var ret = seq([char('λ'), variable, char('.'), expression])(line, idx);
    if(ret == null) return null;
    ret.value = {"type": "lam", "variable": ret.value[1], "body": ret.value[3]};
    return ret;
}

function application(line, idx) {
    var ret = seq([char('('), expression, expression, char(')')])(line, idx);
    if(ret == null) return null;
    ret.value = {"type": "app", "expr1": ret.value[1], "expr2": ret.value[2]};
    return ret;
}

function expression(line, idx) {
    return choice([lambda, application, variable])(line, idx);
}

function parse(line) {
    var ret = expression(line, 0);
    if(ret.end != line.length) return null;
    return ret.value;
}

function unparse(expr) {
    if(expr == null) return "null";
    switch(expr.type) {
        case "var": 
            return expr.name;
        case "lam":
            return "λ" + unparse(expr.variable) + "." + unparse(expr.body);
        case "app":
            return "(" + unparse(expr.expr1) + unparse(expr.expr2) + ")";
        default:
            throw "invalid λ-expression";
    }
}