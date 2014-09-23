/**
 * Insert a vertex into this graph.
 * 
 * @param vertex A valid Vertex instance
 */
function insertVertex(vertex)
{
  this.vertices.push(vertex);
  this.vertexCount++;
}

/**
 * Insert an edge vertex1 --> vertex2.
 *  
 * @param label Label for this edge
 * @param weight Weight of this edge
 * @param vertex1 Starting Vertex instance
 * @param vertex2 Ending Vertex instance
 * @return Newly created Edge instance
 */
function insertEdge(label, weight, vertex1, vertex2, style)
{
  var e1 = new Edge(label, weight, vertex2, style);
  var e2 = new Edge(null, weight, vertex1, null);
  
  vertex1.edges.push(e1);
  vertex2.reverseEdges.push(e2)
  
  return e1;
}

/** 
 * Delete edge.
 *
 * @param vertex Starting vertex
 * @param edge Edge to remove
 */
 function removeEdge(vertex1, vertex2) 
 {
  for (var i = vertex1.edges.length - 1; i >= 0; i--) {
    if (vertex1.edges[i].endVertex == vertex2) {
      vertex1.edges.splice(i,1);
      break;
    }
  }
  
  for (var i = vertex2.reverseEdges.length - 1; i >= 0; i--) {
    if (vertex2.reverseEdges[i].endVertex == vertex1) {
      vertex2.reverseEdges.splice(i,1);
      break;
    }
  }
 }

/** 
 * Delete vertex.
 *
 * @param vertex Vertex to remove from the graph
 */
 function removeVertex(vertex) 
 {
  for (var i = vertex.edges.length - 1; i >= 0; i-- ) {
    this.removeEdge(vertex, vertex.edges[i].endVertex);
  }
  
  for (var i = vertex.reverseEdges.length - 1; i >= 0; i-- ) {
    this.removeEdge(vertex.reverseEdges[i].endVertex, vertex);
  }
  
  for (var i = this.vertices.length - 1; i >= 0; i-- ) {
    if (this.vertices[i] == vertex) {
      this.vertices.splice(i,1);
      break;
    }
  }
  
  this.vertexCount--;
 }
 
/**
 * Plots this graph to a canvas.
 *
 * @param canvas A proper canvas instance
 */
function plot(canvas)
{
  /* Draw edges first */
  for (i = 0; i < this.vertices.length; i++) {
    var v = this.vertices[i];
    if (!v.hidden) {
      for (var j = 0; j < v.edges.length; j++) {
        var e = v.edges[j];
        /* Draw edge (if not hidden) */
        if (!e.hidden)
          e.draw(canvas, v);
      }
    }
  }
  
  /* Draw the vertices. */
  for (i = 0; i < this.vertices.length; i++) {
    v = this.vertices[i];
  
    /* Draw vertex (if not hidden) */
    if (!v.hidden)
      v.draw(canvas);
  }
}

/**
 * Graph object constructor.
 * 
 * @param label Label of this graph
 * @param directed true or false
 */
function Graph(label, directed)
{
  /* Fields. */
  this.label = label;
  this.vertices = new Array();
  this.directed = directed;
  this.vertexCount = 0;
  
  /* Graph methods. */
  this.insertVertex = insertVertex;
  this.removeVertex = removeVertex;
  this.insertEdge = insertEdge;
  this.removeEdge = removeEdge;
  this.plot = plot;
}

/**
 * Vertex object constructor.
 * 
 * @param label Label of this vertex
 * @param next Reference to the next vertex of this graph
 * @param firstEdge First edge of a linked list of edges
 */
function Vertex(label, x, y, style)
{
  this.label = label;
  this.edges = new Array();
  this.reverseEdges = new Array();
  this.x = x;
  this.y = y;
  this.dx = 0;
  this.dy = 0;
  this.level = -1;
  this.numberOfParents = 0;
  this.hidden = false;
  this.fixed = false;     // Fixed vertices are static (unmovable)
  
  if(style != null) {
      this.style = style;
  }
  else { // Default
      this.style = new VertexStyle('ellipse', 80, 40, '#ffffff', '#000000', true);
  }
}

/**
 * toString overload for easier debugging
 */
 Vertex.prototype.toString = function() {
    return "[v:" + this.label + "] ";
}

/**
 * toString overload for easier debugging
 */
 Edge.prototype.toString = function() {
    return "[e:" + this.endVertex.label + "] ";
}

/**
 * Draw vertex method.
 *
 * @param canvas jsGraphics instance
 */
 Vertex.prototype.draw = function(canvas)
 {
  var x = this.x;
  var y = this.y;
  var width = this.style.width;
  var height = this.style.height;
  var shape = this.style.shape;
  
  canvas.setStroke(2);
  canvas.setColor(this.style.fillColor);
  
  if(shape == 'rect') {
    canvas.fillRect(x, y, width, height);
    canvas.setColor(this.style.borderColor);
    canvas.drawRect(x, y, width, height);
  }
  else { // Default to ellipse
    canvas.fillEllipse(x, y, width, height);
    canvas.setColor(this.style.borderColor);
    canvas.drawEllipse(x, y, width, height);
  }
  
  if(this.style.showLabel) {
    canvas.drawStringRect(this.label, x, y + height/2 - 7, width, 'center');
  }
 }
 
 /**
 * VertexStyle object type for defining vertex style options.
 *
 * @param shape Shape of the vertex ('ellipse' or 'rect')
 * @param width Width in px
 * @param height Height in px
 * @param fillColor The color with which the vertex is drawn (RGB HEX string)
 * @param borderColor The color with which the border of the vertex is drawn (RGB HEX string)
 * @param showLabel Show the vertex label or not
 */
function VertexStyle(shape, width, height, fillColor, borderColor, showLabel)
{
  this.shape = shape;
  this.width = width;
  this.height = height;
  this.fillColor = fillColor;
  this.borderColor = borderColor;
  this.showLabel = showLabel;
}
 
/**
 * Edge object constructor.
 *
 * @param label Label of this edge
 * @param next Next edge reference
 * @param weight Edge weight
 * @param endVertex Destination Vertex instance
 */
function Edge(label, weight, endVertex, style)
{
  this.label = label;
  this.weight = weight;
  this.endVertex = endVertex;
  this.style = null;
  this.hidden = false;
    
  // Curving information
  this.curved = false;
  this.controlX = -1;   // Control coordinates for Bezier curve drawing
  this.controlY = -1;
  this.original = null; // If this is a temporary edge it holds the original edge
  
  if(style != null) {    
    this.style = style;
  }
  else {  // Set to default
    this.style = new EdgeStyle(2, '#000000', true, false);
  }
}


/**
 * Fits the graph into the bounding box
 *
 * @param width
 * @param height
 * @param preserveAspect
 */
Graph.prototype.normalize = function(width, height, preserveAspect) 
{
  for (var i8 in this.vertices) {
    var v = this.vertices[i8];
    v.oldX = v.x;
    v.oldY = v.y;
  }
  var mnx = width  * 0.1;
  var mxx = width  * 0.9;
  var mny = height * 0.1;
  var mxy = height * 0.9;
  if (preserveAspect == null)
    preserveAspect = true;
  
  var minx = Number.MAX_VALUE;
  var miny = Number.MAX_VALUE
  var maxx = Number.MIN_VALUE;
  var maxy = Number.MIN_VALUE;
  
  for (var i7 in this.vertices) {
    var v = this.vertices[i7];
    if (v.x < minx) minx = v.x;
    if (v.y < miny) miny = v.y;
    if (v.x > maxx) maxx = v.x;
    if (v.y > maxy) maxy = v.y;
  }
  var kx = (mxx-mnx) / (maxx - minx);
  var ky = (mxy-mny) / (maxy - miny);

  if (preserveAspect) {
    kx = Math.min(kx, ky);
    ky = Math.min(kx, ky);
  }
  
  var newMaxx = Number.MIN_VALUE;
  var newMaxy = Number.MIN_VALUE;
  for (var i8 in this.vertices) {
    var v = this.vertices[i8];
    v.x = (v.x - minx) * kx;
    v.y = (v.y - miny) * ky;
    if (v.x > newMaxx) newMaxx = v.x;
    if (v.y > newMaxy) newMaxy = v.y;
  }

  var dx = ( width  - newMaxx ) / 2.0;
  var dy = ( height - newMaxy ) / 2.0;
  for (var i8 in this.vertices) {
    var v = this.vertices[i8];
    v.x += dx;
    v.y += dy;
  }
}

/**
 * Draw edge method. Draws edge "v" --> "this".
 *
 * @param canvas jsGraphics instance
 * @param v Start vertex
 */
Edge.prototype.draw = function(canvas, v) 
{
  var x1 = Math.round(v.x + v.style.width/2);
  var y1 = Math.round(v.y + v.style.height/2);
  var x2 = Math.round(this.endVertex.x + this.endVertex.style.width/2);
  var y2 = Math.round(this.endVertex.y + this.endVertex.style.height/2);

  // Control point (needed only for curved edges)
  var x3 = this.controlX;
  var y3 = this.controlY;
  
  // Arrow tip and angle
  var X_TIP, Y_TIP, ANGLE;

  /* Quadric Bezier curve definition. */
  function Bx(t) { return (1-t)*(1-t)*x1 + 2*(1-t)*t*x3 + t*t*x2; }
  function By(t) { return (1-t)*(1-t)*y1 + 2*(1-t)*t*y3 + t*t*y2; }

  canvas.setStroke(this.style.width);
  canvas.setColor(this.style.color);
  
  if(this.curved) { // Draw a quadric Bezier curve
    this.curved = false; // Reset
    var t = 0, dt = 1/10;
    var xs = x1, ys = y1, xn, yn;
    
    while (t < 1-dt) {
      t += dt;
      xn = Bx(t);
      yn = By(t);
      canvas.drawLine(xs, ys, xn, yn);
      xs = xn;
      ys = yn;
    }
    
    // Set the arrow tip coordinates
    X_TIP = xs;
    Y_TIP = ys;
    
    // Move the tip to (0,0) and calculate the angle 
    // of the arrow head
    ANGLE = angularCoord(Bx(1-2*dt) - X_TIP, By(1-2*dt) - Y_TIP);
    
  } else {
    canvas.drawLine(x1, y1, x2, y2);
    
    // Set the arrow tip coordinates
    X_TIP = x2;
    Y_TIP = y2;
    
    // Move the tip to (0,0) and calculate the angle 
    // of the arrow head
    ANGLE = angularCoord(x1 - X_TIP, y1 - Y_TIP);
  }
  
  if(this.style.showArrow) { 
    drawArrow(ANGLE, X_TIP, Y_TIP);
  }
  
  // TODO
  if(this.style.showLabel) {
  }
  
  /** 
   * Draws an edge arrow. 
   * @param phi The angle (in radians) of the arrow in polar coordinates. 
   * @param x X coordinate of the arrow tip.
   * @param y Y coordinate of the arrow tip.
   */
  function drawArrow(phi, x, y) 
  {
    // Arrow bounding box (in px)
    var H = 50;
    var W = 10;
    
    // Set cartesian coordinates of the arrow
    var p11 = 0, p12 = 0;
    var p21 = H, p22 = W/2;
    var p31 = H, p32 = -W/2;
    
    // Convert to polar coordinates
    var r2 = radialCoord(p21, p22);
    var r3 = radialCoord(p31, p32);
    var phi2 = angularCoord(p21, p22);
    var phi3 = angularCoord(p31, p32);
    
    // Rotate the arrow
    phi2 += phi;
    phi3 += phi;
    
    // Update cartesian coordinates
    p21 = r2 * Math.cos(phi2);
    p22 = r2 * Math.sin(phi2);    
    p31 = r3 * Math.cos(phi3);
    p32 = r3 * Math.sin(phi3);
    
    // Translate
    p11 += x; 
    p12 += y;
    p21 += x;
    p22 += y;
    p31 += x;
    p32 += y;
    
    // Draw
    canvas.fillPolygon(new Array(p11, p21, p31), new Array(p12, p22, p32));
  }
  
  /** 
   * Get the angular coordinate.
   * @param x X coordinate
   * @param y Y coordinate
   */
   function angularCoord(x, y)
   {
     var phi;
     
     if (x > 0 && y >= 0) {
      phi = Math.atan(y/x);
     }
     if (x > 0 && y < 0) {
       phi = Math.atan(y/x) + 2*Math.PI;
     }
     if (x < 0) {
       phi = Math.atan(y/x) + Math.PI;
     }
     if (x = 0 && y > 0) {
       phi = Math.PI/2;
     }
     if (x = 0 && y < 0) {
       phi = 3*Math.PI/2;
     }
     
     return phi;
   }
   
   /** 
    * Get the radian coordiante.
    * @param x1 
    * @param y1 
    * @param x2
    * @param y2 
    */
   function radialCoord(x, y) 
   {
     return Math.sqrt(x*x + y*y);
   }
}

/**
 * EdgeStyle object type for defining vertex style options.
 *
 * @param width Edge line width
 * @param color The color with which the edge is drawn
 * @param showArrow Draw the edge arrow (only if directed)
 * @param showLabel Show the edge label or not
 */
function EdgeStyle(width, color, showArrow, showLabel)
{
  this.width = width;
  this.color = color;
  this.showArrow = showArrow;
  this.showLabel = showLabel;
}