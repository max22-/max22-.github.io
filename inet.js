/* Configuration ******** */
const node_size = 30;
const font_size = 24;
const font_height = font_size / 2;  // Probably not exact, but good enough to center 
                                    // symbol vertically inside nodes
const control_poinst_dist = 100;
const spring_l0 = 5 * node_size;
const spring_stiffness = 0.1;
const repulsion_coeff = 100000;
const friction_coeff = 0.3;
const center_coeff = 0.01;
/* ********************** */


function spring(p1, p2) {
    var vec_x = p2[0] - p1[0];
    var vec_y = p2[1] - p1[1];
    var d = Math.sqrt(Math.pow(vec_x, 2) + Math.pow(vec_y, 2));
    d = Math.max(d, 0.1); // Little fix to avoid division by zero
    return [spring_stiffness*(d-spring_l0)*vec_x/d, 
            spring_stiffness*(d-spring_l0)*vec_y/d];
}

function repulsion(p1, p2) {
    var vec_x = p2[0] - p1[0];
    var vec_y = p2[1] - p1[1];
    var d = Math.sqrt(Math.pow(vec_x, 2) + Math.pow(vec_y, 2));
    d = Math.max(d, 0.1); // Little fix to avoid division by zero
    return [-repulsion_coeff * vec_x / Math.pow(d, 3), 
            -repulsion_coeff * vec_y / Math.pow(d, 3)];
}

function friction(v) {
    return [-friction_coeff*v[0], -friction_coeff*v[1]];
}

function center(w, h, p) {
    return [center_coeff*(w/2 - p[0]), center_coeff * (h/2 - p[1])];
}

function wire(dnode, dport) {
    return {"dnode": dnode, "dport": dport}
}

class Node {
    constructor(tag, glyph) {
        this.tag = tag,
        this.ports = [wire(null, null), wire(null, null), wire(null, null)];
        this.glyph= glyph;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
    }

    get pos() {
        return [this.x, this.y];
    }

    set pos(p) {
        this.x = p[0];
        this.y = p[1];
    }

    get velocity() {
        return [this.vx, this.vy];
    }

    set velocity(v) {
        this.vx = v[0];
        this.vy = v[1];
    }

    apply_force(f) {
        this.vx += f[0]
        this.vy += f[1]
    }

    link(p, w) {
        this.ports[p] = w;
    }
}

class TriangleNode extends Node {
    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y-node_size/2);
        ctx.lineTo(this.x + node_size,this.y + node_size/2);
        ctx.lineTo(this.x - node_size, this.y + node_size/2);
        ctx.lineTo(this.x, this.y - node_size/2);
        ctx.stroke();
        ctx.fillText(this.glyph, this.x, this.y + font_height);
        ctx.closePath();
    }

    port_pos(p) {
        switch(p) {
            case 0:
                return [this.x, this.y-node_size/2, 
                        this.x, this.y-node_size/2 - control_poinst_dist];
            case 1:
                return [this.x + node_size/2, this.y + node_size/2,
                        this.x + node_size/2, this.y + node_size/2 + control_poinst_dist];
            case 2:
                return [this.x - node_size/2, this.y + node_size/2,
                        this.x - node_size/2, this.y + node_size/2 + control_poinst_dist];
            default:
                throw "invalid port";
        }
    }
}

class CircleNode extends Node {
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, node_size/2, 0, 2*Math.PI);
        ctx.stroke();
        ctx.fillText(this.glyph, this.x, this.y + font_height*0.6);
        ctx.closePath();
    }

    port_pos(p) {
        if(p == 0)
            return [this.x, this.y-node_size/2,
                    this.x, this.y-node_size/2 - control_poinst_dist];
        else throw "invalid port";
    }
}

class Lam extends TriangleNode {
    constructor() {
        super("lam", "λ")
    }
    clone() { 
        var c = new Lam();
        c.x = this.x;
        c.y = this.y;
        return c;
    }
}

class App extends TriangleNode {
    constructor() {
        super("lam", "@")
    }
    clone() { 
        var c = new App();
        c.x = this.x;
        c.y = this.y;
        return c;
    }
}

class Dup extends TriangleNode {
    static id = 0;
    constructor(tag) {
        if(tag == undefined) super("dup" + Dup.id++, "δ");
        else super(tag, "δ");
    }
    clone() { 
        var c = new Dup(this.tag);
        c.x = this.x;
        c.y = this.y;
        return c;
    }
}

class Era extends CircleNode {
    constructor() {
        super("era", "ε");
    }
    clone() { return new Era(); }
}

class Root extends CircleNode {
    constructor() {
        super("root", "R")
    }
}

class Net {
    constructor() {
        this.nodes = []
        this.free_list = []
        this.redexes = []
    }

    add_node(node) {
        var id;
        if(this.free_list.length > 0) {
            id = this.free_list.pop();
            this.nodes[id] = node;
        }
        else {
            id = this.nodes.length;
            this.nodes.push(node);
        }
        console.log("added node " + id);
        return id;
    }

    free_node(node) {
        if(node instanceof Node) {
            node = this.get_node_id(node)
            if(node==null) throw "Node not found";
        }
        console.log("freeing node " + node);
        this.free_list.push(node);
        this.nodes[node] = null;
    }

    get_node_id(node) {
        for(var i = 0; i < this.nodes.length; i++)
            if(this.nodes[i] == node) return i;
        return null;
    }

    link(node1, p1, node2, p2) {
        var n1, n2;
        if(node1 instanceof Node) {
            n1 = this.get_node_id(node1)
            if(n1==null) throw "Node not found";
        } else n1 = node1;
        if(node2 instanceof Node) {
            n2 = this.get_node_id(node2);
            if(n2 == null) throw "Node not found";
        } else n2 = node2;
        console.log("-----Link----")
        console.log(n1 + " " + p1 + " <--> " + n2 + " " + p2);
        console.log("node1:");
        console.log(this.nodes[n1]);
        console.log("node2:");
        console.log(this.nodes[n2]);
        console.log("-------------")
        this.nodes[n1].link(p1, wire(n2, p2))
        this.nodes[n2].link(p2, wire(n1, p1));
        if(p1 == 0 && p2 == 0 && this.nodes[n1].tag != "root" && this.nodes[n2].tag != "root")
            this.redexes.push([n1, n2]);
    }

    check() {
        for(var n1 = 0; n1 < this.nodes.length; n1++) {
            if(this.nodes[n1] == null) continue;
            for(var p1 = 0; p1 < 3; p1++) {
                var w2 = this.enter(n1, p1);
                if(w2.dnode != null) {
                    var wc = this.enter(w2.dnode, w2.dport);
                    if(wc.dnode != n1 || wc.dport != p1)
                        throw "invalid net";
                }
            }
        }
    }

    enter(n, p) {
        return this.nodes[n].ports[p];
    }

    apply_forces(ctx) {
        for(var n1 = 0; n1 < this.nodes.length; n1++) {
            if(this.nodes[n1] == null) continue;
            for(var n2 = 0; n2 < this.nodes.length; n2++) {
                if(this.nodes[n2] == null) continue;
                if(n1 != n2) {
                    for(var p1 = 0; p1 < 3; p1++) {
                        for(var p2 = 0; p2 < 3; p2++) {
                            var w = this.enter(n1, p1);
                            if(w.dnode == n2) {
                                var f = spring(this.nodes[n1].port_pos(p1), this.nodes[n2].port_pos(w.dport));
                                this.nodes[n1].apply_force(f);
                            }
                        }
                    }
                    var f2 = repulsion(this.nodes[n1].pos, this.nodes[n2].pos);
                    this.nodes[n1].apply_force(f2);
                }
            }
        }
        this.nodes.forEach(node => {
            if(node != null) {
                node.apply_force(friction(node.velocity));
                node.apply_force(center(ctx.canvas.width, ctx.canvas.height, node.pos));
            }
        });
    }

    apply_velocity() {
        this.nodes.forEach(node => {
            if(node != null) {
                node.x += node.vx;
                node.y += node.vy;
            }
        });
    }

    scatter_nodes() {
        this.nodes.forEach(node => {
            if(node != null) {
                node.x = Math.floor(Math.random()*canvas.width);
                node.y = Math.floor(Math.random()*canvas.height);
                node.vx = 0;
                node.vy = 0;
            }
        });
    }

    draw(ctx) {
        this.apply_forces(ctx);
        this.apply_velocity();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // TODO: links are drawn twice, it would be better once :)
        for(var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if(node != null) {
                node.draw(ctx);
                for(var p = 0; p < 3; p++) {
                    var port = node.ports[p];
                    if(port.dnode != null) {
                        var [x1, y1, xc1, yc1] = node.port_pos(p);
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        var w = this.enter(i, p);
                        if(this.nodes[w.dnode] == null) throw "port connected to nothing";
                        var [x2, y2, xc2, yc2] = this.nodes[w.dnode].port_pos(w.dport);
                        ctx.bezierCurveTo(xc1, yc1, xc2, yc2, x2, y2);
                        this.redexes.forEach(r => {
                            if((r[0] == i && r[1] == w.dnode) || (r[0] == w.dnode && r[1] == i))
                                ctx.strokeStyle = "rgb(255, 0, 0)";
                            else
                                ctx.strokeStyle = "rgb(0, 0, 0)";
                        });
                        ctx.stroke();
                        ctx.strokeStyle = "rgb(0, 0, 0)";
                    }
                }
            }
        };
        // Debugging
        for(i = 0; i < this.nodes.length; i++) {
            if(this.nodes[i] != null) {
                ctx.beginPath();
                ctx.fillText(i, this.nodes[i].x + node_size / 2, this.nodes[i].y);
            }
        }
    }
}

function build_net() {
    var net = new Net();
    /*
    //var expr = "(λf.λx.(f(fx))λf.λx.(f(fx)))";
    */
    var expr = "((λm.λn.λf.λx.((mf)((nf)x))λs.λz.(s(sz)))λs.λz.(s(sz)))";
    var parsed_expr = parse(expr);
    if(parsed_expr == null)
        throw "parse error";
    console.log(parsed_expr);
    compile(parsed_expr, net);
    
    
    /*
    net.nodes = [
        new Lam(),
        new Lam(),
        new Lam(),
        new Dup(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Dup(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Dup(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Lam(),
        new Root()
      ]
      net.link(20, 0, 0, 0);
      net.link(2, 0, 0, 1);
      net.link(3, 0, 0, 2);
      net.link(3, 2, 1, 0);
      net.link(2, 1, 1, 1);
      net.link(4, 1, 1, 2);
      net.link(0, 1, 2, 0);
      net.link(1, 1, 2, 1);
      net.link(4, 2, 2, 2);
      net.link(0, 2, 3, 0);
      net.link(4, 0, 3, 1);
      net.link(1, 0, 3, 2);
      net.link(3, 1, 4, 0);
      net.link(1, 2, 4, 1);
      net.link(2, 2, 4, 2);
      net.link(19, 0, 5, 0);
      net.link(7, 0, 5, 1);
      net.link(8, 0, 5, 2);
      net.link(8, 2, 6, 0);
      net.link(7, 1, 6, 1);
      net.link(9, 1, 6, 2);
      net.link(5, 1, 7, 0);
      net.link(6, 1, 7, 1);
      net.link(9, 2, 7, 2);
      net.link(5, 2, 8, 0);
      net.link(9, 0, 8, 1);
      net.link(6, 0, 8, 2);
      net.link(8, 1, 9, 0);
      net.link(6, 2, 9, 1);
      net.link(7, 2, 9, 2);
      net.link(19, 2, 10, 0);
      net.link(12, 0, 10, 1);
      net.link(18, 0, 10, 2);
      net.link(12, 2, 11, 0);
      net.link(13, 0, 11, 1);
      net.link(15, 2, 11, 2);
      net.link(10, 1, 12, 0);
      net.link(14, 0, 12, 1);
      net.link(11, 0, 12, 2);
      net.link(11, 1, 13, 0);
      net.link(17, 2, 13, 1);
      net.link(16, 2, 13, 2);
      net.link(12, 1, 14, 0);
      net.link(16, 0, 14, 1);
      net.link(15, 0, 14, 2);
      net.link(14, 2, 15, 0);
      net.link(18, 2, 15, 1);
      net.link(11, 2, 15, 2);
      net.link(14, 1, 16, 0);
      net.link(17, 1, 16, 1);
      net.link(13, 2, 16, 2);
      net.link(18, 1, 17, 0);
      net.link(16, 1, 17, 1);
      net.link(13, 1, 17, 2);
      net.link(10, 2, 18, 0);
      net.link(17, 0, 18, 1);
      net.link(15, 1, 18, 2);
      net.link(5, 0, 19, 0);
      net.link(20, 2, 19, 1);
      net.link(10, 0, 19, 2);
      net.link(0, 0, 20, 0);
      net.link(21, 0, 20, 1);
      net.link(19, 1, 20, 2);
      */
    net.scatter_nodes();
    console.log(net);
    return net;
}

function reduce(net) {
    console.log("reduce()");
    /*console.log("node 13 : " + JSON.stringify(net.nodes[13]));
    console.log("node 14 : " + JSON.stringify(net.nodes[14]));
    console.log("node 11 : " + JSON.stringify(net.nodes[11]));
    console.log("node 8 : " + JSON.stringify(net.nodes[8]));


    console.log(net.enter(14, 2));
    console.log(net.enter(13, 2));
    */
    
    if(net.redexes.length == 0) alert("done !");
    var [n1, n2] = net.redexes.pop();
    var node1 = net.nodes[n1];
    var node2 = net.nodes[n2];
    
    console.log("redex " + n1 + " " + n2)
    console.log(node1.tag + " <--> " + node2.tag);

    if(node1.tag == "era" && node2.tag == "era") {
        net.free_node(n1);
        net.free_node(n2);
    } else if(n1.tag == "era" || n2.tag == "era") {
        throw "not implemented yet";
    }
    else if(node1.tag == node2.tag) {
        console.log("annihilation");
        var w11 = net.enter(n1, 1);
        var w12 = net.enter(n1, 2);
        var w21 = net.enter(n2, 1);
        var w22 = net.enter(n2, 2);
        net.link(w11.dnode, w11.dport, w21.dnode, w21.dport);
        net.link(w12.dnode, w12.dport, w22.dnode, w22.dport);
        net.free_node(n1);
        net.free_node(n2);
    } else if (node1.tag != node2.tag && node1) {
        console.log("commutation");
        var w11 = net.enter(n1, 1);
        var w12 = net.enter(n1, 2);
        var w21 = net.enter(n2, 1);
        var w22 = net.enter(n2, 2);

        var new1 = net.add_node(node2.clone()),
            new2 = net.add_node(node2.clone()),
            new3 = net.add_node(node1.clone()), 
            new4 = net.add_node(node1.clone());

        net.link(new1, 0, w11.dnode, w11.dport);
        net.link(new2, 0, w12.dnode, w12.dport);
        net.link(new3, 0, w21.dnode, w21.dport);
        net.link(new4, 0, w22.dnode, w22.dport);
        
        net.link(new1, 1, new3, 1);
        net.link(new1, 2, new4, 1);
        net.link(new2, 1, new3, 2);
        net.link(new2, 2, new4, 2);

        net.free_node(n1);
        net.free_node(n2);
    } else throw("unreachable");
    console.log("new redexes: ");
    console.log(net.redexes);
    console.log(net);
    net.check();
    console.log("check ok");
}

function draw() {
    var canvas = document.getElementById("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.font = font_size + "px serif";
    ctx.textAlign = "center";
    ctx.beginPath();

    var net = build_net(ctx);
    
    setInterval(() => net.draw(ctx));

    canvas.onmousedown = function(e) {
        if(e.button == 0) {
            console.log();
            console.log();
            console.log();
            console.log("left click");
            reduce(net);
        }
        else if(e.button == 1)
            net.scatter_nodes();
    }

    canvas.onmouseup = function(e) {

    }

    canvas.onmousemove = function(e) {

    }
};
