;(function($$){ "use strict";

	var CanvasRenderer = $$('renderer', 'canvas');

	// Draw node
	CanvasRenderer.prototype.drawNode = function(context, node, drawOverlayInstead) {

		var nodeWidth, nodeHeight;
		
		if ( !node.visible() ) {
			return;
		}

		var parentOpacity = node.effectiveOpacity();
		if( parentOpacity === 0 ){ return; }

		// context.fillStyle = "orange";
		// context.fillRect(node.position().x, node.position().y, 2, 2);
		
		nodeWidth = this.getNodeWidth(node);
		nodeHeight = this.getNodeHeight(node);
		
		context.lineWidth = node._private.style["border-width"].pxValue;

		if( drawOverlayInstead === undefined || !drawOverlayInstead ){

			// Node color & opacity
			context.fillStyle = "rgba(" 
				+ node._private.style["background-color"].value[0] + ","
				+ node._private.style["background-color"].value[1] + ","
				+ node._private.style["background-color"].value[2] + ","
				+ (node._private.style["background-opacity"].value 
				* node._private.style["opacity"].value * parentOpacity) + ")";
			
			// Node border color & opacity
			context.strokeStyle = "rgba(" 
				+ node._private.style["border-color"].value[0] + ","
				+ node._private.style["border-color"].value[1] + ","
				+ node._private.style["border-color"].value[2] + ","
				+ (node._private.style["border-opacity"].value * node._private.style["opacity"].value * parentOpacity) + ")";
			
			context.lineJoin = 'miter'; // so borders are square with the node shape
			
			//var image = this.getCachedImage("url");
			
			var url = node._private.style["background-image"].value[2] ||
				node._private.style["background-image"].value[1];
			
			if (url != undefined) {
				
				var r = this;
				var image = this.getCachedImage(url,
						
						function() {
							
//							console.log(e);
							r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
							r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;
							
							// Replace Image object with Canvas to solve zooming too far
							// into image graphical errors (Jan 10 2013)
							r.swapCachedImage(url);
							
							r.redraw();
						}
				);
				
				if (image.complete == false) {

					CanvasRenderer.nodeShapes[r.getNodeShape(node)].drawPath(
						context,
						node._private.position.x,
						node._private.position.y,
					    nodeWidth, nodeHeight);
						//node._private.style["width"].value,
						//node._private.style["height"].value);
					
					context.stroke();
					context.fillStyle = "#555555";
					context.fill();
					
				} else {
					//context.clip
					this.drawInscribedImage(context, image, node);
				}
				
			} else {

				// Draw node
				CanvasRenderer.nodeShapes[this.getNodeShape(node)].draw(
					context,
					node._private.position.x,
					node._private.position.y,
					nodeWidth,
					nodeHeight); //node._private.data.weight / 5.0
			}
			
			this.drawPie(context, node);

			// Border width, draw border
			if (node._private.style["border-width"].pxValue > 0) {
				CanvasRenderer.nodeShapes[this.getNodeShape(node)].drawPath(
					context,
					node._private.position.x,
					node._private.position.y,
					nodeWidth,
					nodeHeight)
				;

				context.stroke();
			}

      this.drawNodeAnnotations(context, node, drawOverlayInstead);

		// draw the overlay
		} else {

			var overlayPadding = node._private.style["overlay-padding"].pxValue;
			var overlayOpacity = node._private.style["overlay-opacity"].value;
			var overlayColor = node._private.style["overlay-color"].value;
			if( overlayOpacity > 0 ){
				context.fillStyle = "rgba( " + overlayColor[0] + ", " + overlayColor[1] + ", " + overlayColor[2] + ", " + overlayOpacity + " )";

				CanvasRenderer.nodeShapes['roundrectangle'].draw(
					context,
					node._private.position.x,
					node._private.position.y,
					nodeWidth + overlayPadding * 2,
					nodeHeight + overlayPadding * 2
				);
			}
		}

	};

	// does the node have at least one pie piece?
	CanvasRenderer.prototype.hasPie = function(node){
		node = node[0]; // ensure ele ref

		for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
			var size = node._private.style['pie-' + i + '-background-size'].value;

			if( size > 0 ){
				return true;
			}
		}

		return false;
	};

	CanvasRenderer.prototype.drawPie = function(context, node){
		node = node[0]; // ensure ele ref

		if( !this.hasPie(node) ){ return; } // exit early if not needed

		var nodeW = this.getNodeWidth( node );
		var nodeH = this.getNodeHeight( node );
		var x = node._private.position.x;
		var y = node._private.position.y;
		var radius = Math.min( nodeW, nodeH ) / 2; // must fit in node
		var lastPercent = 0; // what % to continue drawing pie slices from on [0, 1]

		context.save();

		// clip to the node shape
		CanvasRenderer.nodeShapes[ this.getNodeShape(node) ]
			.drawPath( context, x, y, nodeW, nodeH )
		;
		context.clip();

		for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
			var size = node._private.style['pie-' + i + '-background-size'].value;
			var color = node._private.style['pie-' + i + '-background-color'];
			var percent = size / 100; // map integer range [0, 100] to [0, 1]
			var angleStart = 1.5 * Math.PI + 2 * Math.PI * lastPercent; // start at 12 o'clock and go clockwise
			var angleDelta = 2 * Math.PI * percent;
			var angleEnd = angleStart + angleDelta;

			// slice start and end points
			var sx1 = x + radius * Math.cos( angleStart );
			var sy1 = y + radius * Math.sin( angleStart );

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

			context.fillStyle = 'rgb(' 
				+ color.value[0] + ','
				+ color.value[1] + ','
				+ color.value[2] + ')'
			;

			context.fill();

			lastPercent += percent;
		}

		context.restore();
	};

  // Draw node annotations
  CanvasRenderer.prototype.drawNodeAnnotations = function(context, node, drawOverlayInstead) {
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
          context.fillStyle = annotation.color;
          this.drawNodeAnnotationShape(context,annotation.shape,ax,ay,annSize,angle);
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
          context.fillStyle = annotation.color;
          this.drawNodeAnnotationShape(context,annotation.shape,ax,ay,annSize,angle);
          ++cAnnIndex;
        }
      }
    }
    if( numUnknAnns > 0 ) {
      var annDispl = 2.0 * annSize + annHorizSpacing;
      
      var labelStyle   = node._private.style["font-style"].strValue;
      var labelSize    = node._private.style["font-size"].value + "px";
      var labelFamily  = node._private.style["font-family"].strValue;
      var labelVariant = node._private.style["font-variant"].strValue;
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
          context.fillStyle = annotation.color;
          this.drawNodeAnnotationShape(context,annotation.shape,ax,annYstart,annSize,0);
          ++uAnnIndex;
        }
      }
    }
  };

  // Draw edge annotation shapes
  CanvasRenderer.prototype.drawNodeAnnotationShape = function(context, shape, annPosX, annPosY, size, angle) {
  
    context.translate(annPosX, annPosY);
    
    context.moveTo(0, 0);

    context.rotate(angle);
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