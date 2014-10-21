;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');

// Draw edge
  CanvasRenderer.prototype.drawEdge = function(context, edge, drawOverlayInstead) {
    var rs = edge._private.rscratch;
    var usePaths = CanvasRenderer.usePaths();

    // if bezier ctrl pts can not be calculated, then die
    if( rs.badBezier || (rs.edgeType === 'bezier' && isNaN(rs.startX)) ){ // extra isNaN() for safari 7.1 b/c it mangles ctrlpt calcs
      return;
    }

    var style = edge._private.style;
    
    // Edge line width
    if (style['width'].pxValue <= 0) {
      return;
    }

    var overlayPadding = style['overlay-padding'].pxValue;
    var overlayOpacity = style['overlay-opacity'].value;
    var overlayColor = style['overlay-color'].value;

    // Edge color & opacity
    if( drawOverlayInstead ){

      if( overlayOpacity === 0 ){ // exit early if no overlay
        return;
      }

      this.strokeStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);
      context.lineCap = 'round';

      if( edge._private.rscratch.edgeType == 'self' && !usePaths ){
        context.lineCap = 'butt';
      }

    } else {
      var lineColor = style['line-color'].value;

      this.strokeStyle(context, lineColor[0], lineColor[1], lineColor[2], style.opacity.value);
      
      context.lineCap = 'butt'; 
    }
    
    var startNode, endNode, source, target;
    source = startNode = edge._private.source;
    target = endNode = edge._private.target;

    var targetPos = target._private.position;
    var targetW = target.width();
    var targetH = target.height();
    var sourcePos = source._private.position;
    var sourceW = source.width();
    var sourceH = source.height();


    var edgeWidth = style['width'].pxValue + (drawOverlayInstead ? 2 * overlayPadding : 0);
    var lineStyle = drawOverlayInstead ? 'solid' : style['line-style'].value;
    context.lineWidth = edgeWidth;
    
    if( rs.edgeType !== 'haystack' ){
      //this.findEndpoints(edge);
    }
    
    if( rs.edgeType === 'haystack' ){
      var radius = style['haystack-radius'].value;
      var halfRadius = radius/2; // b/c have to half width/height

      this.drawStyledEdge(
        edge, 
        context, 
        rs.haystackPts = [
          rs.source.x * sourceW * halfRadius + sourcePos.x,
          rs.source.y * sourceH * halfRadius + sourcePos.y,
          rs.target.x * targetW * halfRadius + targetPos.x,
          rs.target.y * targetH * halfRadius + targetPos.y
        ],
        lineStyle,
        edgeWidth
      );
    } else if (rs.edgeType === 'self') {
      
      var details = edge._private.rscratch;
      var points = [details.startX, details.startY, details.cp2ax,
        details.cp2ay, details.selfEdgeMidX, details.selfEdgeMidY,
        details.selfEdgeMidX, details.selfEdgeMidY,
        details.cp2cx, details.cp2cy, details.endX, details.endY];

      var details = edge._private.rscratch;
      this.drawStyledEdge(edge, context, points, lineStyle, edgeWidth);
      
    } else if (rs.edgeType === 'straight') {
      
      var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
      var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
      
      var edgeDirectionX = rs.endX - rs.startX;
      var edgeDirectionY = rs.endY - rs.startY;
      
      if (nodeDirectionX * edgeDirectionX
        + nodeDirectionY * edgeDirectionY < 0) {
        
        rs.straightEdgeTooShort = true;  
      } else {
        
        var details = rs;
        this.drawStyledEdge(edge, context, [details.startX, details.startY,
                                      details.endX, details.endY],
                                      lineStyle,
                                      edgeWidth);
        
        rs.straightEdgeTooShort = false;  
      }  
    } else {
      
      var details = rs;
      
      this.drawStyledEdge(edge, context, [details.startX, details.startY,
        details.cp2x, details.cp2y, details.endX, details.endY],
        lineStyle,
        edgeWidth);
      
    }
    
    if( rs.edgeType === 'haystack' ){
      this.drawArrowheads(context, edge, drawOverlayInstead);
    } else if ( rs.noArrowPlacement !== true && rs.startX !== undefined ){
      this.drawArrowheads(context, edge, drawOverlayInstead);
    }

    if ( rs.edgeType !== 'haystack' ) {
      this.drawEdgeAnnotations(context, edge, drawOverlayInstead);
    }
  };
  
  
  CanvasRenderer.prototype.drawStyledEdge = function(
      edge, context, pts, type, width) {

    // 3 points given -> assume Bezier
    // 2 -> assume straight
    
    var rs = edge._private.rscratch;
    var canvasCxt = context;
    var path;
    var pathCacheHit = false;
    var usePaths = CanvasRenderer.usePaths();


    if( usePaths ){

      var pathCacheKey = pts;
      var keyLengthMatches = rs.pathCacheKey && pathCacheKey.length === rs.pathCacheKey.length;
      var keyMatches = keyLengthMatches;

      for( var i = 0; keyMatches && i < pathCacheKey.length; i++ ){
        if( rs.pathCacheKey[i] !== pathCacheKey[i] ){
          keyMatches = false;
        }
      }

      if( keyMatches ){
        path = context = rs.pathCache;
        pathCacheHit = true;
      } else {
        path = context = new Path2D();
        rs.pathCacheKey = pathCacheKey;
        rs.pathCache = path;
      }

    }

    if( canvasCxt.setLineDash ){ // for very outofdate browsers
      switch( type ){
        case 'dotted':
          canvasCxt.setLineDash([ 1, 1 ]);
          break;

        case 'dashed':
          canvasCxt.setLineDash([ 6, 3 ]);
          break;

        case 'solid':
          canvasCxt.setLineDash([ ]);
          break;
      }
    }

    if( !pathCacheHit ){
      if( context.beginPath ){ context.beginPath(); }
      context.moveTo(pts[0], pts[1]);
      
      if (pts.length === 3 * 2) { // bezier
        context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      } else if( pts.length === 3 * 2 * 2 ){ // double bezier loop
        context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
        context.quadraticCurveTo(pts[8], pts[9], pts[10], pts[11]);
      } else { // line
        context.lineTo(pts[2], pts[3]);
      }
    }

    context = canvasCxt;
    if( usePaths ){
      context.stroke( path );
    } else {
      context.stroke();
    }
  
    // reset any line dashes
    if( context.setLineDash ){ // for very outofdate browsers
      context.setLineDash([ ]);
    }

  };

  CanvasRenderer.prototype.drawArrowheads = function(context, edge, drawOverlayInstead) {
    if( drawOverlayInstead ){ return; } // don't do anything for overlays 

    var rs = edge._private.rscratch;
    var self = this;
    var isHaystack = rs.edgeType === 'haystack';

    // Displacement gives direction for arrowhead orientation
    var dispX, dispY;
    var startX, startY, endX, endY;

    var srcPos = edge.source().position();
    var tgtPos = edge.target().position();

    if( isHaystack ){
      startX = rs.haystackPts[0];
      startY = rs.haystackPts[1];
      endX = rs.haystackPts[2];
      endY = rs.haystackPts[3];
    } else {
      startX = rs.arrowStartX;
      startY = rs.arrowStartY;
      endX = rs.arrowEndX;
      endY = rs.arrowEndY;
    }

    var style = edge._private.style;
    
    function drawArrowhead( prefix, x, y, dispX, dispY ){
      var arrowShape = style[prefix + '-arrow-shape'].value;

      if( arrowShape === 'none' ){
        return;
      }

      var gco = context.globalCompositeOperation;

      context.globalCompositeOperation = 'destination-out';
      
      self.fillStyle(context, 255, 255, 255, 1);


      var arrowClearFill = style[prefix + '-arrow-fill'].value === 'hollow' ? 'both' : 'filled';
      var arrowFill = style[prefix + '-arrow-fill'].value;

      if( arrowShape === 'half-triangle-overshot' ){
        arrowFill = 'hollow';
        arrowClearFill = 'hollow';
      }

      self.drawArrowShape( edge, prefix, context, 
        arrowClearFill, style['width'].pxValue, style[prefix + '-arrow-shape'].value, 
        x, y, dispX, dispY
      );

      context.globalCompositeOperation = gco;

      var color = style[prefix + '-arrow-color'].value;
      self.fillStyle(context, color[0], color[1], color[2], style.opacity.value);

      self.drawArrowShape( edge, prefix, context, 
        arrowFill, style['width'].pxValue, style[prefix + '-arrow-shape'].value, 
        x, y, dispX, dispY
      );
    }

    dispX = startX - srcPos.x;
    dispY = startY - srcPos.y;

    if( !isHaystack && !isNaN(startX) && !isNaN(startY) && !isNaN(dispX) && !isNaN(dispY) ){
      drawArrowhead( 'source', startX, startY, dispX, dispY );

    } else {
      // window.badArrow = true;
      // debugger;
    }
    
    var midX = rs.midX;
    var midY = rs.midY;

    if( isHaystack ){
      midX = ( startX + endX )/2;
      midY = ( startY + endY )/2;
    }

    dispX = startX - endX;
    dispY = startY - endY;

    if( rs.edgeType === 'self' ){
      dispX = 1;
      dispY = -1;
    }

    if( !isNaN(midX) && !isNaN(midY) ){
      drawArrowhead( 'mid-target', midX, midY, dispX, dispY );
    }

    dispX *= -1;
    dispY *= -1;

    if( !isNaN(midX) && !isNaN(midY) ){
      drawArrowhead( 'mid-source', midX, midY, dispX, dispY );
    }
    
    dispX = endX - tgtPos.x;
    dispY = endY - tgtPos.y;
    
    if( !isHaystack && !isNaN(endX) && !isNaN(endY) && !isNaN(dispX) && !isNaN(dispY) ){
      drawArrowhead( 'target', endX, endY, dispX, dispY );
    }
  };
  
  // Draw arrowshape
  CanvasRenderer.prototype.drawArrowShape = function(edge, arrowType, context, fill, edgeWidth, shape, x, y, dispX, dispY) {
    var usePaths = CanvasRenderer.usePaths();
    var rs = edge._private.rscratch;
    var pathCacheHit = false;
    var path;
    var canvasContext = context;
    var translation = { x: x, y: y };

    // Negative of the angle
    var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
  
    if (dispX < 0) {
      angle = angle + Math.PI / 2;
    } else {
      angle = - (Math.PI / 2 + angle);
    }
    
    var size = this.getArrowWidth( edgeWidth );
    var shapeImpl = CanvasRenderer.arrowShapes[shape];

    // context.translate(x, y);

    if( usePaths ){
      var pathCacheKey = size + '$' + shape + '$' + angle + '$' + x + '$' + y;
      rs.arrowPathCacheKey = rs.arrowPathCacheKey || {};
      rs.arrowPathCache = rs.arrowPathCache || {};

      var alreadyCached = rs.arrowPathCacheKey[arrowType] === pathCacheKey;
      if( alreadyCached ){
        path = context = rs.arrowPathCache[arrowType];
        pathCacheHit = true;
      } else {
        path = context = new Path2D();
        rs.arrowPathCacheKey[arrowType] = pathCacheKey;
        rs.arrowPathCache[arrowType] = path;
      }
    }

    if( context.beginPath ){ context.beginPath(); }

    if( !pathCacheHit ){
      shapeImpl.draw(context, size, angle, translation);
    }
    
    if( !shapeImpl.leavePathOpen && context.closePath ){
      context.closePath();
    }

    context = canvasContext;

    if( fill === 'filled' || fill === 'both' ){
      if( usePaths ){
        context.fill( path );
      } else {
        context.fill();
      }
    }

    if( fill === 'hollow' || fill === 'both' ){
      context.lineWidth = ( shapeImpl.matchEdgeWidth ? edgeWidth : 1 );
      context.lineJoin = 'miter';

      if( usePaths ){
        context.stroke( path );
      } else {
        context.stroke();
      }
      
    }

    // context.translate(-x, -y);
  };

  // Draw annotations on edge
  CanvasRenderer.prototype.drawEdgeAnnotations = function(context, edge, drawOverlayInstead) {
    if( drawOverlayInstead ){ return; } // don't do anything for overlays 

    if( typeof edge.data().sourceAnnotations === 'undefined' &&
        typeof edge.data().targetAnnotations === 'undefined' ) {
      return;
    }

    var START_DISPL = 0.07;
    var WIDTH_DISPL = 0.33;
    var SPACE_MULT  = 2.4;

    var START_SELF_DISPL = 0.33;
    var WIDTH_SELF_DISPL = 0.32;
    var SPACE_SELF_MULT  = 2.9;

    function qbezierLen(p0x, p0y, p1x, p1y, p2x, p2y){
      var ax = p0x - 2*p1x + p2x;  var ay = p0y - 2*p1y + p2y;
      var bx = 2*p1x - 2*p0x;      var by = 2*p1y - 2*p0y;
      var A = 4*(ax*ax + ay*ay);   var B = 4*(ax*bx + ay*by);
      var C = bx*bx + by*by;       var Sabc = 2*Math.sqrt(A+B+C);
      var A_2 = Math.sqrt(A);      var A_32 = 2*A*A_2;
      var C_2 = 2*Math.sqrt(C);    var BA = B/A_2;
      return (A_32*Sabc + A_2*B*(Sabc-C_2) + (4*C*A-B*B)*Math.log( (2*A_2+BA+Sabc)/(BA+C_2) ))/(4*A_32);
    }

    function qbezierAt(p0, p1, p2, t){
      return (1 - t)*(1 - t)*p0 + 2*(1 - t)*t*p1 + t*t*p2;
    }

    function qbezierDeltaAt(p0, p1, p2, t){
      return (t-1)*p0 + (1-2*t)*p1 + t*p2;
    }

    var annSize = edge._private.style["ann-size"].value;
    var details = edge._private.rscratch;

    // Instead of the edge starting point we take the arrow starting point in
    // order to avoid overlaps with the node body. Slightly imprecise but
    // I don't think anyone will ever notice
    var startX = details.startX;
    var startY = details.startY;
    var endX   = details.endX;
    var endY   = details.endY;

    if (details.edgeType == "straight") {

      var exdispl = endX-startX;
      var eydispl = endY-startY;
      var elen    = Math.sqrt(exdispl*exdispl + eydispl*eydispl);
      var angle = 0.0;
      if( exdispl == 0 ) {
        if( eydispl > 0 ) {
          angle = 0;
        } else {
          angle = Math.PI;
        }
      } else {
        angle = Math.atan( (eydispl/exdispl) );
        if( exdispl < 0 ) {
          angle += Math.PI;
        }
      }
      if( typeof edge.data().sourceAnnotations != 'undefined' ) {
        var lSourceAnnotations = edge.data().sourceAnnotations;
        var displ      = Math.max(Math.min(((SPACE_MULT*annSize)/elen),(WIDTH_DISPL-annSize/elen)/lSourceAnnotations.length),0.0);
        var startDispl = Math.min(START_DISPL+annSize/(2.0*elen),START_DISPL+WIDTH_DISPL/2.0);
        for (var i = 0; i < lSourceAnnotations.length; ++i) {
          var annotation = lSourceAnnotations[i];
          
          var annPosX = startX + exdispl * (startDispl + i * displ);
          var annPosY = startY + eydispl * (startDispl + i * displ);

          this.drawEdgeAnnotationShape(context, annotation.shape,
                annPosX, annPosY, annSize, angle, annotation.color, annotation.enriched);
        }
      }

      if( typeof edge.data().targetAnnotations != 'undefined' ) {
        var lTargetAnnotations = edge.data().targetAnnotations;
        var displ      = Math.max(Math.min(((SPACE_MULT*annSize)/elen),(WIDTH_DISPL-annSize/elen)/lTargetAnnotations.length),0.0);
        var startDispl = Math.min(START_DISPL+annSize/(2.0*elen),START_DISPL+WIDTH_DISPL/2.0);
        for (var i = 0; i < lTargetAnnotations.length; i++) {
          var annotation = lTargetAnnotations[i];
  
          var annPosX = endX - exdispl * (startDispl + i * displ);
          var annPosY = endY - eydispl * (startDispl + i * displ);
          
          this.drawEdgeAnnotationShape(context, annotation.shape,
                annPosX, annPosY, annSize, angle+Math.PI, annotation.color, annotation.enriched);
        }
      }
      
    } else if (details.edgeType == "self"){

      // TODO: (Roberto) Modify this code to cope with a generic self-edge.
      // Currently runs under the assumption that the self edge is simmetrical
      // as in the new design
      //
      // !Please notice! Target annotations for self-edges are simply ignored

      if( typeof edge.data().sourceAnnotations != 'undefined' ) {
        var lSourceAnnotations = edge.data().sourceAnnotations;
        var elen    = 2.0*qbezierLen(startX, startY, details.cp2ax, details.cp2ay, details.selfEdgeMidX, details.selfEdgeMidY);
        var displ   = Math.max(Math.min(((SPACE_SELF_MULT*annSize)/elen),(WIDTH_SELF_DISPL-annSize/elen)/lSourceAnnotations.length),0.0);
        var startDispl = Math.min(START_SELF_DISPL+annSize/(2.0*elen),START_SELF_DISPL+WIDTH_SELF_DISPL/2.0);
  
        for (var i = 0; i < lSourceAnnotations.length; ++i) {
          var annotation = lSourceAnnotations[i];
          
          var t = startDispl + i * displ;
          var p0, p1, p2;
          if( t < 0.5 ) {
            p0 = [ startX, startY ];
            p1 = [ details.cp2ax, details.cp2ay ];
            p2 = [ details.selfEdgeMidX, details.selfEdgeMidY ];
            t  = 2.0*t;
          } else {
            p0 = [ details.selfEdgeMidX, details.selfEdgeMidY ];
            p1 = [ details.cp2cx, details.cp2cy ];
            p2 = [ endX, endY ];
            t  = 2*(t-0.5);
          }

          var annPosX = qbezierAt(p0[0], p1[0], p2[0], t);
          var annPosY = qbezierAt(p0[1], p1[1], p2[1], t);

          var bxdispl = qbezierDeltaAt(p0[0], p1[0], p2[0], t);
          var bydispl = qbezierDeltaAt(p0[1], p1[1], p2[1], t);

          var angle = 0.0;
          if( bxdispl == 0 ) {
            if( bydispl > 0 ) {
              angle = 0;
            } else {
              angle = Math.PI;
            }
          } else {
            angle = Math.atan( (bydispl/bxdispl) );
            if( bxdispl < 0 ) {
              angle += Math.PI;
            }
          }

          this.drawEdgeAnnotationShape(context, annotation.shape,
              annPosX, annPosY, annSize, angle, annotation.color, annotation.enriched);
        }
      }
      
    } else {

      var elen    = qbezierLen(startX, startY, details.cp2x, details.cp2y, endX, endY);
      if( typeof edge.data().sourceAnnotations != 'undefined' ) {
        var lSourceAnnotations = edge.data().sourceAnnotations;
        var displ      = Math.max(Math.min(((SPACE_MULT*annSize)/elen),(WIDTH_DISPL-annSize/elen)/lSourceAnnotations.length),0.0);
        var startDispl = Math.min(START_DISPL+annSize/(2.0*elen),START_DISPL+WIDTH_DISPL/2.0);
  
        for (var i = 0; i < lSourceAnnotations.length; ++i) {
          var annotation = lSourceAnnotations[i];
  
          var t = startDispl + i * displ;
          var annPosX = qbezierAt(startX, details.cp2x, endX, t);
          var annPosY = qbezierAt(startY, details.cp2y, endY, t);
          
          var bxdispl = qbezierDeltaAt(startX, details.cp2x, endX, t);
          var bydispl = qbezierDeltaAt(startY, details.cp2y, endY, t);
          var angle = 0.0;
          if( bxdispl == 0 ) {
            if( bydispl > 0 ) {
              angle = 0;
            } else {
              angle = Math.PI;
            }
          } else {
            angle = Math.atan( (bydispl/bxdispl) );
            if( bxdispl < 0 ) {
              angle += Math.PI;
            }
          }

          this.drawEdgeAnnotationShape(context, annotation.shape,
              annPosX, annPosY, annSize, angle, annotation.color, annotation.enriched);
        }
      }
      
      if( typeof edge.data().targetAnnotations != 'undefined' ) {
        var lTargetAnnotations = edge.data().targetAnnotations;
        var displ      = Math.max(Math.min(((SPACE_MULT*annSize)/elen),(WIDTH_DISPL-annSize/elen)/lTargetAnnotations.length),0.0);
        var startDispl = Math.min(START_DISPL+annSize/(2.0*elen),START_DISPL+WIDTH_DISPL/2.0);

        for (var i = 0; i < lTargetAnnotations.length; i++) {
          var annotation = lTargetAnnotations[i];

          var t = 1.0 - startDispl - i * displ;
          var annPosX = qbezierAt(startX, details.cp2x, endX, t);
          var annPosY = qbezierAt(startY, details.cp2y, endY, t); 

          var bxdispl = qbezierDeltaAt(startX, details.cp2x, endX, t);
          var bydispl = qbezierDeltaAt(startY, details.cp2y, endY, t);
          var angle = 0.0;
          if( bxdispl == 0 ) {
            if( bydispl > 0 ) {
              angle = 0;
            } else {
              angle = Math.PI;
            }
          } else {
            angle = Math.atan( (bydispl/bxdispl) );
            if( bxdispl < 0 ) {
              angle += Math.PI;
            }
          }

          this.drawEdgeAnnotationShape(context, annotation.shape,
              annPosX, annPosY, annSize, angle+Math.PI, annotation.color, annotation.enriched);
        }
      }      

    }
  }

  // Draw edge annotation shapes
  CanvasRenderer.prototype.drawEdgeAnnotationShape = function(context, shape, annPosX, annPosY, size, angle, annColor, enriched) {
  
    context.translate(annPosX, annPosY);
    
    context.moveTo(0, 0);

    context.rotate(angle);

    if( Boolean(enriched) ) {
      var enrichedSize = size*1.3;
      context.fillStyle = annColor;
      context.scale(enrichedSize, enrichedSize);
      context.beginPath();
      CanvasRenderer.annotationShapes[shape].draw(context);
      context.closePath();
      context.fill();
      context.scale(1/enrichedSize, 1/enrichedSize);
      enrichedSize = size*1.0;
      context.fillStyle = "#FFFFFF";
      context.scale(enrichedSize, enrichedSize);
      context.beginPath();
      CanvasRenderer.annotationShapes[shape].draw(context);
      context.closePath();
      context.fill();
      context.scale(1/enrichedSize, 1/enrichedSize);
      size = 0.7 * size;
    }

    context.fillStyle = annColor;
    context.scale(size, size);
    context.beginPath();
    CanvasRenderer.annotationShapes[shape].draw(context);
    context.closePath();
    context.fill();
    context.scale(1/size, 1/size);
    
    context.rotate(-angle);
    
    context.translate(-annPosX, -annPosY);
  }

  
})( cytoscape );
