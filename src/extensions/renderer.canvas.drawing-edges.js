;(function($$){ "use strict";

	var CanvasRenderer = $$('renderer', 'canvas');

// Draw edge
	CanvasRenderer.prototype.drawEdge = function(context, edge, drawOverlayInstead) {

		if( !edge.visible() ){
			return;
		}

		if( this.hideEdgesOnViewport && (this.dragData.didDrag || this.pinching || this.hoverData.dragging || this.data.wheel || this.swipePanning) ){ return; } // save cycles on pinching

		var rs = edge._private.rscratch;

		// if bezier ctrl pts can not be calculated, then die
		if( rs.badBezier ){
			return;
		}

		var startNode, endNode;

		startNode = edge.source()[0];
		endNode = edge.target()[0];
		
		if ( 
			   edge._private.style["visibility"].value != "visible"
			|| edge._private.style["display"].value != "element"
			|| startNode._private.style["visibility"].value != "visible"
			|| startNode._private.style["display"].value != "element"
			|| endNode._private.style["visibility"].value != "visible"
			|| endNode._private.style["display"].value != "element"
		){
			return;
		}
		
		var overlayPadding = edge._private.style["overlay-padding"].pxValue;
		var overlayOpacity = edge._private.style["overlay-opacity"].value;
		var overlayColor = edge._private.style["overlay-color"].value;

		// Edge color & opacity
		if( drawOverlayInstead ){
			context.strokeStyle = "rgba( " + overlayColor[0] + ", " + overlayColor[1] + ", " + overlayColor[2] + ", " + overlayOpacity + " )";
			context.lineCap = "round";

			if( edge._private.rscratch.edgeType == "self"){
				context.lineCap = "butt";
			}

		} else {
			context.strokeStyle = "rgba(" 
				+ edge._private.style["line-color"].value[0] + ","
				+ edge._private.style["line-color"].value[1] + ","
				+ edge._private.style["line-color"].value[2] + ","
				+ edge._private.style.opacity.value + ")";

			
			context.lineCap = "butt"; 
		}

		// Edge line width
		if (edge._private.style["width"].pxValue <= 0) {
			return;
		}
		
		var edgeWidth = edge._private.style["width"].pxValue + (drawOverlayInstead ? 2 * overlayPadding : 0);
		var lineStyle = drawOverlayInstead ? "solid" : edge._private.style["line-style"].value;
		context.lineWidth = edgeWidth;
		
		this.findEndpoints(edge);
		
		if (edge._private.rscratch.edgeType == "self") {
					
			var details = edge._private.rscratch;
			this.drawStyledEdge(edge, context, [details.startX, details.startY, details.cp2ax,
				details.cp2ay, details.selfEdgeMidX, details.selfEdgeMidY],
				lineStyle,
				edgeWidth);
			
			this.drawStyledEdge(edge, context, [details.selfEdgeMidX, details.selfEdgeMidY,
				details.cp2cx, details.cp2cy, details.endX, details.endY],
				lineStyle,
				edgeWidth);

			// DEBUG: draw projected bezier pts
			// context.fillStyle = 'red';
			// var bpts = edge._private.rstyle.bezierPts;
			// for( var i = 0; i < bpts.length; i++ ){
			// 	var pt = bpts[i];

			// 	context.fillRect(pt.x, pt.y, 2, 2);
			// }
			
		} else if (edge._private.rscratch.edgeType == "straight") {
			
			var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
			var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
			
			var edgeDirectionX = edge._private.rscratch.endX - edge._private.rscratch.startX;
			var edgeDirectionY = edge._private.rscratch.endY - edge._private.rscratch.startY;
			
			if (nodeDirectionX * edgeDirectionX
				+ nodeDirectionY * edgeDirectionY < 0) {
				
				edge._private.rscratch.straightEdgeTooShort = true;	
			} else {
				
				var details = edge._private.rscratch;
				this.drawStyledEdge(edge, context, [details.startX, details.startY,
				                              details.endX, details.endY],
				                              lineStyle,
				                              edgeWidth);
				
				edge._private.rscratch.straightEdgeTooShort = false;	
			}	
		} else {
			
			var details = edge._private.rscratch;

			// context.fillStyle = 'rgba(255, 0, 0, 1)';
			// context.fillRect(details.startX, details.startY, 2, 2);
			// context.fillRect(details.endX, details.endY, 2, 2);

			// context.fillStyle = edge._private.style['line-color'].strValue;
			// context.fillRect(details.cp2x, details.cp2y, 2, 2);

			
			this.drawStyledEdge(edge, context, [details.startX, details.startY,
				details.cp2x, details.cp2y, details.endX, details.endY],
				lineStyle,
				edgeWidth);

			// DEBUG: draw projected bezier pts
			// context.fillStyle = 'red';
			// var bpts = edge._private.rstyle.bezierPts;
			// for( var i = 0; i < bpts.length; i++ ){
			// 	var pt = bpts[i];

			// 	context.fillRect(pt.x, pt.y, 2, 2);
			// }
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(context, edge, drawOverlayInstead);
		}

    this.drawEdgeAnnotations(context, edge, drawOverlayInstead);

	};
	
	var _genPoints = function(pt, spacing, even) {
		
		var approxLen = Math.sqrt(Math.pow(pt[4] - pt[0], 2) + Math.pow(pt[5] - pt[1], 2));
		approxLen += Math.sqrt(Math.pow((pt[4] + pt[0]) / 2 - pt[2], 2) + Math.pow((pt[5] + pt[1]) / 2 - pt[3], 2));

		var pts = Math.ceil(approxLen / spacing); var inc = approxLen / spacing;
		var pz;
		
		if (pts > 0) {
			pz = new Array(pts * 2);
		} else {
			return null;
		}
		
		for (var i = 0; i < pts; i++) {
			var cur = i / pts;
			pz[i * 2] = pt[0] * (1 - cur) * (1 - cur) + 2 * (pt[2]) * (1 - cur) * cur + pt[4] * (cur) * (cur);
			pz[i * 2 + 1] = pt[1] * (1 - cur) * (1 - cur) + 2 * (pt[3]) * (1 - cur) * cur + pt[5] * (cur) * (cur);
		}
		
		return pz;
	};
	
	var _genStraightLinePoints = function(pt, spacing, even) {
		
		var approxLen = Math.sqrt(Math.pow(pt[2] - pt[0], 2) + Math.pow(pt[3] - pt[1], 2));
		
		var pts = Math.ceil(approxLen / spacing);
		var pz;
		
		if (pts > 0) {
			pz = new Array(pts * 2);
		} else {
			return null;
		}
		
		var lineOffset = [pt[2] - pt[0], pt[3] - pt[1]];
		for (var i = 0; i < pts; i++) {
			var cur = i / pts;
			pz[i * 2] = lineOffset[0] * cur + pt[0];
			pz[i * 2 + 1] = lineOffset[1] * cur + pt[1];
		}
		
		return pz;
	};
	
	var _genEvenOddpts = function(pt, evenspac, oddspac) {
		
		pt1 = _genpts(pt, evenspac);
		pt2 = _genpts(pt, oddspac);
	};
	
	
	CanvasRenderer.prototype.drawStyledEdge = function(
			edge, context, pts, type, width) {
		
		// 3 points given -> assume Bezier
		// 2 -> assume straight
		
		var cy = this.data.cy;
		var zoom = cy.zoom();
		

		// Adjusted edge width for dotted
//		width = Math.max(width * 1.6, 3.4) * zoom;

		//		console.log("w", width);

		if (type == "solid") {
			
			context.beginPath();
			context.moveTo(pts[0], pts[1]);
			if (pts.length == 3 * 2) {
				context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
			} else {
				context.lineTo(pts[2], pts[3]);
			}
//			context.closePath();
			context.stroke();
			
		} else if (type == "dotted") {
			
			var pt;
			if (pts.length == 3 * 2) {
				pt = _genPoints(pts, 16, true);
			} else {
				pt = _genStraightLinePoints(pts, 16, true);
			}
			
			if (!pt) { return; }
			
			var dotRadius = Math.max(width * 1.6, 3.4) * zoom;
			var bufW = dotRadius * 2, bufH = dotRadius * 2;
			bufW = Math.max(bufW, 1);
			bufH = Math.max(bufH, 1);
			
			var buffer = this.createBuffer(bufW, bufH);
			
			var context2 = buffer[1];
//			console.log(buffer);
//			console.log(bufW, bufH);
			
			// Draw on buffer
			context2.setTransform(1, 0, 0, 1, 0, 0);
			context2.clearRect(0, 0, bufW, bufH);
			
			context2.fillStyle = context.strokeStyle;
			context2.beginPath();
			context2.arc(bufW/2, bufH/2, dotRadius * 0.5, 0, Math.PI * 2, false);
			context2.fill();
			
			// Now use buffer
			context.beginPath();
			//context.save();
			
			for (var i=0; i<pt.length/2; i++) {
				
//				context.beginPath();
//				context.arc(pt[i*2], pt[i*2+1], width * 0.5, 0, Math.PI * 2, false);
//				context.fill();
				
				context.drawImage(
						buffer[0],
						pt[i*2] - bufW/2 / zoom,
						pt[i*2+1] - bufH/2 / zoom,
						bufW / zoom,
						bufH / zoom);
			}
			
			//context.restore();
			
		} else if (type == "dashed") {
			var pt;
			if (pts.length == 3 * 2) {
				pt = _genPoints(pts, 14, true);
			} else {
				pt = _genStraightLinePoints(pts, 14, true);
			}
			if (!pt) { return; }
			
//			var dashSize = Math.max(width * 1.6, 3.4);
//			dashSize = Math.min(dashSize)
			
			//var bufW = width * 2 * zoom, bufH = width * 2.5 * zoom;
			var bufW = width * 2 * zoom
			var bufH = 7.8 * zoom;
			bufW = Math.max(bufW, 1);
			bufH = Math.max(bufH, 1);
			
			var buffer = this.createBuffer(bufW, bufH);
			var context2 = buffer[1];

			// Draw on buffer
			context2.setTransform(1, 0, 0, 1, 0, 0);
			context2.clearRect(0, 0, bufW, bufH);
			
			if (context.strokeStyle) {
				context2.strokeStyle = context.strokeStyle;
			}
			
			context2.lineWidth = width * cy.zoom();
			
	//		context2.fillStyle = context.strokeStyle;
			
			context2.beginPath();
			context2.moveTo(bufW / 2, bufH * 0.2);
			context2.lineTo(bufW / 2,  bufH * 0.8);
			
	//		context2.arc(bufH, dotRadius, dotRadius * 0.5, 0, Math.PI * 2, false);
			
	//		context2.fill();
			context2.stroke();
			
			//context.save();
			
			// document.body.appendChild(buffer[0]);
			
			var quadraticBezierVaryingTangent = false;
			var rotateVector, angle;
			
			// Straight line; constant tangent angle
			if (pts.length == 2 * 2) {
				rotateVector = [pts[2] - pts[0], pts[3] - pt[1]];
				
				angle = Math.acos((rotateVector[0] * 0 + rotateVector[1] * -1) / Math.sqrt(rotateVector[0] * rotateVector[0] 
						+ rotateVector[1] * rotateVector[1]));
	
				if (rotateVector[0] < 0) {
					angle = -angle + 2 * Math.PI;
				}
			} else if (pts.length == 3 * 2) {
				quadraticBezierVaryingTangent = true;
			}
			
			for (var i=0; i<pt.length/2; i++) {
				
				var p = i / (Math.max(pt.length/2 - 1, 1));
			
				// Quadratic bezier; varying tangent
				// So, use derivative of quadratic Bezier function to find tangents
				if (quadraticBezierVaryingTangent) {
					rotateVector = [2 * (1-p) * (pts[2] - pts[0]) 
					                	+ 2 * p * (pts[4] - pts[2]),
					                    2 * (1-p) * (pts[3] - pts[1]) 
					                    + 2 * p * (pts[5] - pts[3])];
	
					angle = Math.acos((rotateVector[0] * 0 + rotateVector[1] * -1) / Math.sqrt(rotateVector[0] * rotateVector[0] 
								+ rotateVector[1] * rotateVector[1]));
	
					if (rotateVector[0] < 0) {
						angle = -angle + 2 * Math.PI;
					}
				}
				
				context.translate(pt[i*2], pt[i*2+1]);
				
				context.rotate(angle);
				context.translate(-bufW/2 / zoom, -bufH/2 / zoom);
				
				context.drawImage(
						buffer[0],
						0,
						0,
						bufW / zoom,
						bufH / zoom);
				
				context.translate(bufW/2 / zoom, bufH/2 / zoom);
				context.rotate(-angle);
				
				context.translate(-pt[i*2], -pt[i*2+1]);
				
			}
			
			
			//context.restore();
		} else {
			this.drawStyledEdge(edge, context, pts, "solid", width);
		}
		
	};

	CanvasRenderer.prototype.drawArrowheads = function(context, edge, drawOverlayInstead) {
		if( drawOverlayInstead ){ return; } // don't do anything for overlays 

		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		var srcPos = edge.source().position();
		dispX = startX - srcPos.x;
		dispY = startY - srcPos.y;
		
		if( !isNaN(startX) && !isNaN(startY) && !isNaN(dispX) && !isNaN(dispY) ){

			var gco = context.globalCompositeOperation;

			context.globalCompositeOperation = "destination-out";
		
			context.lineWidth = edge._private.style["width"].pxValue;
			
			context.fillStyle = 'white';

			this.drawArrowShape(context, edge._private.style["source-arrow-shape"].value, 
				startX, startY, dispX, dispY);

			context.globalCompositeOperation = gco;

			context.fillStyle = "rgba("
				+ edge._private.style["source-arrow-color"].value[0] + ","
				+ edge._private.style["source-arrow-color"].value[1] + ","
				+ edge._private.style["source-arrow-color"].value[2] + ","
				+ edge._private.style.opacity.value + ")";

			this.drawArrowShape(context, edge._private.style["source-arrow-shape"].value, 
				startX, startY, dispX, dispY);

		} else {
			// window.badArrow = true;
			// debugger;
		}
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		var tgtPos = edge.target().position();
		dispX = endX - tgtPos.x;
		dispY = endY - tgtPos.y;
		
		if( !isNaN(endX) && !isNaN(endY) && !isNaN(dispX) && !isNaN(dispY) ){

			var gco = context.globalCompositeOperation;

			context.globalCompositeOperation = "destination-out";

			context.lineWidth = edge._private.style["width"].pxValue;

			context.fillStyle = 'white';

			this.drawArrowShape(context, edge._private.style["target-arrow-shape"].value,
				endX, endY, dispX, dispY);

			context.globalCompositeOperation = gco;

			//this.context.strokeStyle = "rgba("
			context.fillStyle = "rgba("
				+ edge._private.style["target-arrow-color"].value[0] + ","
				+ edge._private.style["target-arrow-color"].value[1] + ","
				+ edge._private.style["target-arrow-color"].value[2] + ","
				+ edge._private.style.opacity.value + ")";	
		
			this.drawArrowShape(context, edge._private.style["target-arrow-shape"].value,
				endX, endY, dispX, dispY);
		}
	};
	
	// Draw arrowshape
	CanvasRenderer.prototype.drawArrowShape = function(context, shape, x, y, dispX, dispY) {
	
		// Negative of the angle
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
	
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		//context.save();
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = this.getArrowWidth(context.lineWidth);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		CanvasRenderer.arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();

		context.scale(1/size, 1/size);
		context.rotate(angle);
		context.translate(-x, -y);
		//context.restore();
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

          context.fillStyle = annotation.color;
          this.drawEdgeAnnotationShape(context, annotation.shape,
                annPosX, annPosY, annSize, angle);
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
          
          context.fillStyle = annotation.color;
          this.drawEdgeAnnotationShape(context, annotation.shape,
                annPosX, annPosY, annSize, angle+Math.PI);
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

          context.fillStyle = annotation.color;
          this.drawEdgeAnnotationShape(context, annotation.shape,
              annPosX, annPosY, annSize, angle);
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

          context.fillStyle = annotation.color;
          this.drawEdgeAnnotationShape(context, annotation.shape,
              annPosX, annPosY, annSize, angle);
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

          context.fillStyle = annotation.color;
          this.drawEdgeAnnotationShape(context, annotation.shape,
              annPosX, annPosY, annSize, angle+Math.PI);
        }
      }      

    }
  };

  // Draw edge annotation shapes
  CanvasRenderer.prototype.drawEdgeAnnotationShape = function(context, shape, annPosX, annPosY, size, angle) {
  
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