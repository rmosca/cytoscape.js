;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var CRp = CanvasRenderer.prototype;

  // Draw node
  CRp.drawNode = function(context, node, drawOverlayInstead) {

    var r = this;
    var nodeWidth, nodeHeight;
    var style = node._private.style;
    var rs = node._private.rscratch;
    var _p = node._private;
    
    var usePaths = CanvasRenderer.usePaths();
    var canvasContext = context;
    var path;
    var pathCacheHit = false;

    var overlayPadding = style['overlay-padding'].pxValue;
    var overlayOpacity = style['overlay-opacity'].value;
    var overlayColor = style['overlay-color'].value;

    if( drawOverlayInstead && overlayOpacity === 0 ){ // exit early if drawing overlay but none to draw
      return;
    }

    var parentOpacity = node.effectiveOpacity();
    if( parentOpacity === 0 ){ return; }

    nodeWidth = this.getNodeWidth(node);
    nodeHeight = this.getNodeHeight(node);
    
    context.lineWidth = style['border-width'].pxValue;

    if( drawOverlayInstead === undefined || !drawOverlayInstead ){

      var url = style['background-image'].value[2] ||
        style['background-image'].value[1];
      var image;

      if (url !== undefined) {
        
        // get image, and if not loaded then ask to redraw when later loaded
        image = this.getCachedImage(url, function(){
          r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
          r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;
          
          r.drawingImage = true;
          
          r.redraw();
        });
        
        var prevBging = _p.backgrounding;
        _p.backgrounding = !image.complete;

        if( prevBging !== _p.backgrounding ){ // update style b/c :backgrounding state changed
          node.updateStyle( false );
        }
      } 

      // Node color & opacity

      var bgColor = style['background-color'].value;
      var borderColor = style['border-color'].value;
      var borderStyle = style['border-style'].value;

      this.fillStyle(context, bgColor[0], bgColor[1], bgColor[2], style['background-opacity'].value * style['opacity'].value * parentOpacity);
      
      this.strokeStyle(context, borderColor[0], borderColor[1], borderColor[2], style['border-opacity'].value * style['opacity'].value * parentOpacity);
      
      var shadowBlur = style['shadow-blur'].pxValue;
      var shadowOpacity = style['shadow-opacity'].value;
      var shadowColor = style['shadow-color'].value;
      var shadowOffsetX = style['shadow-offset-x'].pxValue;
      var shadowOffsetY = style['shadow-offset-y'].pxValue;

      this.shadowStyle(context, shadowColor, shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY);

      context.lineJoin = 'miter'; // so borders are square with the node shape

      if( context.setLineDash ){ // for very outofdate browsers
        switch( borderStyle ){
          case 'dotted':
            context.setLineDash([ 1, 1 ]);
            break;

          case 'dashed':
            context.setLineDash([ 4, 2 ]);
            break;

          case 'solid':
          case 'double':
            context.setLineDash([ ]);
            break;
        }
      }

      
      var styleShape = style['shape'].strValue;

      var pos = node._private.position;

      if( usePaths ){
        var pathCacheKey = styleShape + '$' + nodeWidth +'$' + nodeHeight;

        context.translate( pos.x, pos.y );

        if( rs.pathCacheKey === pathCacheKey ){
          path = context = rs.pathCache;
          pathCacheHit = true;
        } else {
          path = context = new Path2D();
          rs.pathCacheKey = pathCacheKey;
          rs.pathCache = path;
        }
      }

      if( !pathCacheHit ){

        var npos = pos;

        if( usePaths ){
          npos = {
            x: 0,
            y: 0
          };
        }

        CanvasRenderer.nodeShapes[this.getNodeShape(node)].drawPath(
              context,
              npos.x,
              npos.y,
              nodeWidth,
              nodeHeight);
      }

      context = canvasContext;

      if( usePaths ){
        context.fill( path );
      } else {
        context.fill();
      }

      this.shadowStyle(context, 'transparent', 0); // reset for next guy

      if (url !== undefined) {
        if( image.complete ){
          this.drawInscribedImage(context, image, node);
        }
      } 
      
      var darkness = style['background-blacken'].value;
      var borderWidth = style['border-width'].pxValue;

      if( this.hasPie(node) ){
        this.drawPie(context, node);

        // redraw path for blacken and border
        if( darkness !== 0 || borderWidth !== 0 ){

          if( !usePaths ){
            CanvasRenderer.nodeShapes[this.getNodeShape(node)].drawPath(
                context,
                pos.x,
                pos.y,
                nodeWidth,
                nodeHeight);
          }
        }
      }

      if( darkness > 0 ){
        this.fillStyle(context, 0, 0, 0, darkness);

        if( usePaths ){
          context.fill( path );
        } else {
          context.fill();
        }
        
      } else if( darkness < 0 ){
        this.fillStyle(context, 255, 255, 255, -darkness);
        
        if( usePaths ){
          context.fill( path );
        } else {
          context.fill();
        }
      }

      // Border width, draw border
      if (borderWidth > 0) {

        if( usePaths ){
          context.stroke( path );
        } else {
          context.stroke();
        }

        if( borderStyle === 'double' ){
          context.lineWidth = style['border-width'].pxValue/3;

          var gco = context.globalCompositeOperation;
          context.globalCompositeOperation = 'destination-out';

          if( usePaths ){
            context.stroke( path );
          } else {
            context.stroke();
          }

          context.globalCompositeOperation = gco;
        }

      }

      if( usePaths ){
        context.translate( -pos.x, -pos.y );
      }

      // reset in case we changed the border style
      if( context.setLineDash ){ // for very outofdate browsers
        context.setLineDash([ ]);
      }

      this.drawNodeAnnotations(context, node, drawOverlayInstead);
      
    // draw the overlay
    } else {

      if( overlayOpacity > 0 ){
        this.fillStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);

        CanvasRenderer.nodeShapes['roundrectangle'].drawPath(
          context,
          node._private.position.x,
          node._private.position.y,
          nodeWidth + overlayPadding * 2,
          nodeHeight + overlayPadding * 2
        );

        context.fill();
      }
    }

  };

  // does the node have at least one pie piece?
  CRp.hasPie = function(node){
    node = node[0]; // ensure ele ref
    
    return node._private.hasPie;
  };

  CRp.drawPie = function(context, node){
    node = node[0]; // ensure ele ref

    var pieSize = node._private.style['pie-size'];
    var nodeW = this.getNodeWidth( node );
    var nodeH = this.getNodeHeight( node );
    var x = node._private.position.x;
    var y = node._private.position.y;
    var radius = Math.min( nodeW, nodeH ) / 2; // must fit in node
    var lastPercent = 0; // what % to continue drawing pie slices from on [0, 1]
    var usePaths = CanvasRenderer.usePaths();

    if( usePaths ){
      x = 0;
      y = 0;
    }

    if( pieSize.units === '%' ){
      radius = radius * pieSize.value / 100;
    } else if( pieSize.pxValue !== undefined ){
      radius = pieSize.pxValue / 2;
    }

    for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
      var size = node._private.style['pie-' + i + '-background-size'].value;
      var color = node._private.style['pie-' + i + '-background-color'].value;
      var opacity = node._private.style['pie-' + i + '-background-opacity'].value;
      var percent = size / 100; // map integer range [0, 100] to [0, 1]
      var angleStart = 1.5 * Math.PI + 2 * Math.PI * lastPercent; // start at 12 o'clock and go clockwise
      var angleDelta = 2 * Math.PI * percent;
      var angleEnd = angleStart + angleDelta;

      // ignore if
      // - zero size
      // - we're already beyond the full circle
      // - adding the current slice would go beyond the full circle
      if( size === 0 || lastPercent >= 1 || lastPercent + percent > 1 ){
        continue;
      }

      context.beginPath();
      context.moveTo(x, y);
      context.arc( x, y, radius, angleStart, angleEnd );
      context.closePath();

      this.fillStyle(context, color[0], color[1], color[2], opacity);

      context.fill();

      lastPercent += percent;
    }

  };

  // Draw node annotations
  CRp.drawNodeAnnotations = function(context, node, drawOverlayInstead) {
    var nodeWidth = this.getNodeWidth(node);
    var nodeHeight = this.getNodeHeight(node);

    // Annotations, for the moment are drown only for circular nodes
    if( this.getNodeShape(node) != 'ellipse' || nodeWidth != nodeHeight ||
        typeof node.data().nodeAnnotations === 'undefined' ) {
      return;
    }
    
    var annSize = node._private.style["ann-size"].value;
    var annVertSpacing = annSize / 2.0;
    var annHorizSpacing = annSize / 2.0;
    var annSpaceMult    = 3.0;
    
    var lNodeAnnotations = node.data().nodeAnnotations;
    var nodeWidth = this.getNodeWidth(node);
    var nodeHeight = this.getNodeHeight(node);
    var nodeBorderWidth = node._private.style["border-width"].value;
    
    var ringWidth = 2.0 * annSize + 0.5;
    
    // First I need to make the "buried" area darker
    context.fillStyle = "rgba( " + node._private.style["border-color"].value[0] + ","
                                 + node._private.style["border-color"].value[1] + ","
                                 + node._private.style["border-color"].value[2] + ", 0.3 )";

    var coreRingWidth = nodeWidth - nodeBorderWidth - 2.0 * ringWidth;
    CanvasRenderer.nodeShapes["ellipse"].draw(
      context,
      node._private.position.x,
      node._private.position.y,
      coreRingWidth,
      coreRingWidth
    );
    
    var numSurfAnns = 0;
    var numCoreAnns = 0;
    var numUnknAnns = 0;
    for (var i = 0; i < lNodeAnnotations.length; ++i) {
      if ( lNodeAnnotations[i].type == "surface" ){
        ++numSurfAnns;
      } else if( lNodeAnnotations[i].type == "core" ) {
        ++numCoreAnns;
      } else if( lNodeAnnotations[i].type == "unknown" ) {
        ++numUnknAnns;
      }
    }
    
    if( numSurfAnns > 0 ) {
      var surfRingRadius = (nodeWidth-nodeBorderWidth-ringWidth)/2.0;
      var annDispl = Math.min( 2.0 * Math.PI / numSurfAnns, (annSpaceMult*annSize)/surfRingRadius );
      var sAnnIndex = 0;
      for (var i = 0; i < lNodeAnnotations.length; ++i) {
        var annotation = lNodeAnnotations[i];
        if( annotation.type == "surface" ) {
          var angle = annDispl * sAnnIndex;
          var ax = node._private.position.x + surfRingRadius * Math.sin(angle);
          var ay = node._private.position.y - surfRingRadius * Math.cos(angle);
          this.drawNodeAnnotationShape(context,annotation.shape,ax,ay,annSize,angle,annotation.color,annotation.enriched);
          ++sAnnIndex;
        }
      }
    }
    if( numCoreAnns > 0 ) {
      var coreRingRadius = (nodeWidth-nodeBorderWidth-2.0*ringWidth)/4.0;
      var annDispl = 2.0 * Math.PI / numCoreAnns;
      var cAnnIndex = 0;
      for (var i = 0; i < lNodeAnnotations.length; ++i) {
        var annotation = lNodeAnnotations[i];
        if( annotation.type == "core" ) {
          var angle = annDispl * cAnnIndex;
          var ax = node._private.position.x + coreRingRadius * Math.sin(angle);
          var ay = node._private.position.y - coreRingRadius * Math.cos(angle);
          this.drawNodeAnnotationShape(context,annotation.shape,ax,ay,annSize,angle,annotation.color,annotation.enriched);
          ++cAnnIndex;
        }
      }
    }
    if( numUnknAnns > 0 ) {
      var annDispl = 2.0 * annSize + annHorizSpacing;
      
      var labelStyle   = node._private.style["font-style"].strValue;
      var labelSize    = node._private.style["font-size"].value + "px";
      var labelFamily  = node._private.style["font-family"].strValue;
      //var labelVariant = node._private.style["font-variant"].strValue;
      var labelWeight  = node._private.style["font-weight"].strValue;
      
      context.font = labelStyle + " " + labelWeight + " "
                     + labelSize + " " + labelFamily;
      
      var text = String(node._private.style["content"].value);
      var textTransform = node._private.style["text-transform"].value;
      
      if (textTransform == "none") {
      } else if (textTransform == "uppercase") {
        text = text.toUpperCase();
      } else if (textTransform == "lowercase") {
        text = text.toLowerCase();
      }
      
      // Calculate text draw position based on text alignment
     var textWidth, textHeight;
      if (text != undefined) {
        // record the text's width for use in bounding box calc
        textWidth = context.measureText( text ).width;
        textHeight = node._private.style["font-size"].value * 1.3;
      } else {
        textWidth = 0;
        textHeight = 0;
      }

      //var textHorizSpacing = node._private.style["font-size"].pxValue * 0.5;
      //var textVertSpacing  = node._private.style["font-size"].pxValue * 0.5;
      
      var textHorizSpacing = 0;
      var textVertSpacing  = 0;

      var textX, textY, annXstart, annYstart;

      var textHalign = node._private.style["text-halign"].strValue;
      if (textHalign == "left") {
        // Align right boundary of text with left boundary of node
        textX = node._private.position.x - nodeWidth / 2 - textHorizSpacing;
        annXstart = textX - textWidth;
      } else if (textHalign == "right") {
        // Align left boundary of text with right boundary of node
        textX = node._private.position.x + nodeWidth / 2 + textHorizSpacing;
        annXstart = textX;
      } else if (textHalign == "center") {
        textX = node._private.position.x;
        annXstart = textX - textWidth / 2;
      } else {
        // Same as center
        textX = node._private.position.x;
        annXstart = textX - textWidth / 2;
      }
      
      var textValign = node._private.style["text-valign"].strValue;
      if (textValign == "top") {
        textY = node._private.position.y - nodeHeight / 2 - textVertSpacing;
        annYstart = textY - textHeight - annSize - annVertSpacing;
      } else if (textValign == "bottom") {
        textY = node._private.position.y + nodeHeight / 2 + textVertSpacing;
        annYstart = textY + textHeight + annVertSpacing;
      } else if (textValign == "middle" || textValign == "center") {
        textY = node._private.position.y;
        annYstart = textY + textHeight / 2 + annVertSpacing;
      } else {
        // same as center
        textY = node._private.position.y;
        annYstart = textY + textHeight / 2 + annVertSpacing;
      }
      
      annXstart += annSize;
      
      var uAnnIndex = 0;
      for (var i = 0; i < lNodeAnnotations.length; ++i) {
        var annotation = lNodeAnnotations[i];
        if( annotation.type == "unknown" ) {
          var ax = annXstart + annDispl * uAnnIndex;
          this.drawNodeAnnotationShape(context,annotation.shape,ax,annYstart,annSize,0,annotation.color,annotation.enriched);
          ++uAnnIndex;
        }
      }
    }
  };

  // Draw edge annotation shapes
  CRp.drawNodeAnnotationShape = function(context, shape, annPosX, annPosY, size, angle, annColor, enriched) {
  
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
  };

  
})( cytoscape );
