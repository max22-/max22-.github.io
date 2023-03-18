function compile(expr, net) {

    function _compile(expr, env) {
        console.log("compiling " + unparse(expr));
        console.log("env=" + JSON.stringify(env));

        switch(expr.type) {

            case "lam":
                var n = net.add_node(new Lam());
                var e = net.add_node(new Era());
                net.link(n, 2, e, 0);
                var new_env = {...env}
                new_env[expr.variable.name] = wire(n, 2);
                var body = _compile(expr.body, new_env);
                net.link(n, 1, body.dnode, body.dport);
                return wire(n, 0);

            case "var":
                var w = env[expr.name];
                var dst = net.enter(w.dnode, w.dport);
                if(net.nodes[dst.dnode].tag == "era") {
                    return dst;
                } else {
                    var d = net.add_node(new Dup());
                    net.link(d, 0, w.dnode, w.dport);
                    net.link(d, 2, dst.dnode, dst.dport);
                    return wire(d, 1);
                }
            
            case "app":
                var a = net.add_node(new App());
                var expr1 = _compile(expr.expr1, env);
                if(net.nodes[expr1.dnode].tag == "era") {
                    var v = net.enter(expr1.dnode, expr1.dport);
                    net.free_node(expr1.dnode);
                    expr1 = v;
                }
                net.link(a, 0, expr1.dnode, expr1.dport);

                var expr2 = _compile(expr.expr2, env);
                if(net.nodes[expr2.dnode].tag == "era") {
                    var v = net.enter(expr2.dnode, expr2.dport);
                    net.free_node(expr2.dnode);
                    expr2 = v;
                }
                net.link(a, 2, expr2.dnode, expr2.dport);

                return wire(a, 1);
        }
    }
    var r = net.add_node(new Root());
    var res = _compile(expr, {});
    net.link(r, 0, res.dnode, res.dport);
    return r;
}