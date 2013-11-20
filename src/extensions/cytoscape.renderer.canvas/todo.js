/*
  The canvas renderer was written by Yue Dong.

  Modifications tracked on Github.
*/

(function($$) {

	function CanvasRenderer(options) {
		
		CanvasRenderer.CANVAS_LAYERS = 5;
		CanvasRenderer.SELECT_BOX = 0;
		CanvasRenderer.DRAG = 2;
		CanvasRenderer.OVERLAY = 3;
		CanvasRenderer.NODE = 4;
		CanvasRenderer.BUFFER_COUNT = 2;

		this.options = options;

		this.data = {
				
			select: [undefined, undefined, undefined, undefined, 0], // Coordinates for selection box, plus enabled flag 
			renderer: this, cy: options.cy, container: options.cy.container(),
			
			canvases: new Array(CanvasRenderer.CANVAS_LAYERS),
			canvasRedrawReason: new Array(CanvasRenderer.CANVAS_LAYERS),
			canvasNeedsRedraw: new Array(CanvasRenderer.CANVAS_LAYERS),
			
			bufferCanvases: new Array(CanvasRenderer.BUFFER_COUNT)

		};
		
		//--Pointer-related data
		this.hoverData = {down: null, last: null, 
				downTime: null, triggerMode: null, 
				dragging: false, 
				initialPan: [null, null], capture: false};
		
		this.timeoutData = {panTimeout: null};
		
		this.dragData = {possibleDragElements: []};
		
		this.touchData = {start: null, capture: false,
				// These 3 fields related to tap, taphold events
				startPosition: [null, null, null, null, null, null],
				singleTouchStartTime: null,
				singleTouchMoved: true,
				
				
				now: [null, null, null, null, null, null], 
				earlier: [null, null, null, null, null, null] };
		//--
		
		//--Wheel-related data 
		this.zoomData = {freeToZoom: false, lastPointerX: null};
		//--
		
		this.redraws = 0;

		this.bindings = [];
		
		for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {
			this.data.canvases[i] = document.createElement("canvas");
			this.data.canvases[i].style.position = "absolute";
			this.data.canvases[i].setAttribute("data-id", "layer" + i);
			this.data.canvases[i].style.zIndex = String(CanvasRenderer.CANVAS_LAYERS - i);
			this.data.container.appendChild(this.data.canvases[i]);
			
			this.data.canvasRedrawReason[i] = new Array();
			this.data.canvasNeedsRedraw[i] = false;
		}

		this.data.canvases[CanvasRenderer.NODE].setAttribute("data-id", "layer" + CanvasRenderer.NODE + '-node');
		this.data.canvases[CanvasRenderer.SELECT_BOX].setAttribute("data-id", "layer" + CanvasRenderer.SELECT_BOX + '-selectbox');
		this.data.canvases[CanvasRenderer.DRAG].setAttribute("data-id", "layer" + CanvasRenderer.DRAG + '-drag');
		this.data.canvases[CanvasRenderer.OVERLAY].setAttribute("data-id", "layer" + CanvasRenderer.OVERLAY + '-overlay');
		
		for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
			this.data.bufferCanvases[i] = document.createElement("canvas");
			this.data.bufferCanvases[i].style.position = "absolute";
			this.data.bufferCanvases[i].setAttribute("data-id", "buffer" + i);
			this.data.bufferCanvases[i].style.zIndex = String(-i - 1);
			this.data.bufferCanvases[i].style.visibility = "hidden";
			this.data.container.appendChild(this.data.bufferCanvases[i]);
		}

		var overlay = document.createElement('div');
		this.data.container.appendChild( overlay );
		this.data.overlay = overlay;
		overlay.style.position = 'absolute';
		overlay.style.zIndex = 1000;

		if( options.showOverlay ){

			var link = document.createElement('a');
			overlay.appendChild( link );
			this.data.link = link;

			link.innerHTML = 'cytoscape.js';
			link.style.font = '14px helvetica';
			link.style.position = 'absolute';
			link.style.right = 0;
			link.style.bottom = 0;
			link.style.padding = '1px 3px';
			link.style.paddingLeft = '5px';
			link.style.paddingTop = '5px';
			link.style.opacity = 0;
			link.style['-webkit-tap-highlight-color'] = 'transparent';
			link.style.background = 'red';

			link.href = 'http://cytoscape.github.io/cytoscape.js/';
			link.target = '_blank';

		}

		this.hideEdgesOnViewport = options.hideEdgesOnViewport;

		this.load();
	}

	CanvasRenderer.panOrBoxSelectDelay = 400;
	CanvasRenderer.isTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;

	CanvasRenderer.prototype.notify = function(params) {
		if ( params.type == "destroy" ){
			this.destroy();
			return;

		} else if (params.type == "add"
			|| params.type == "remove"
			|| params.type == "load"
		) {
			
			this.updateNodesCache();
			this.updateEdgesCache();
		}

		if (params.type == "viewport") {
			this.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
			this.data.canvasRedrawReason[CanvasRenderer.SELECT_BOX].push("viewchange");
		}
		
		this.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true; this.data.canvasRedrawReason[CanvasRenderer.DRAG].push("notify");
		this.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; this.data.canvasRedrawReason[CanvasRenderer.NODE].push("notify");

		this.redraws++;
		this.redraw();
	};

	CanvasRenderer.prototype.registerBinding = function(target, event, handler, useCapture){
		this.bindings.push({
			target: target,
			event: event,
			handler: handler,
			useCapture: useCapture
		});

		target.addEventListener(event, handler, useCapture);
	};

	CanvasRenderer.prototype.destroy = function(){
		this.destroyed = true;

		for( var i = 0; i < this.bindings.length; i++ ){
			var binding = this.bindings[i];
			var b = binding;

			b.target.removeEventListener(b.event, b.handler, b.useCapture);
		}
	};
	



	
	// @O Drawing functions
	{
	
	// Resize canvas
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var data = this.data; var width = container.clientWidth; var height = container.clientHeight;
		
		var canvas, canvasWidth = width, canvasHeight = height;

		if ('devicePixelRatio' in window) {
			canvasWidth *= devicePixelRatio;
			canvasHeight *= devicePixelRatio;
		}

		for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {

			canvas = data.canvases[i];
			
			if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
				
				canvas.width = canvasWidth;
				canvas.height = canvasHeight;

				canvas.style.width = width + 'px';
				canvas.style.height = height + 'px';
			}
		}
		
		for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
			
			canvas = data.bufferCanvases[i];
			
			if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
				
				canvas.width = canvasWidth;
				canvas.height = canvasHeight;
			}
		}

		this.data.overlay.style.width = width + 'px';
		this.data.overlay.style.height = height + 'px';
	}




	
	
	var imageCache = {};
	
	// Discard after 5 min. of disuse
	var IMAGE_KEEP_TIME = 30 * 300; // 300frames@30fps, or. 5min
	
	CanvasRenderer.prototype.getCachedImage = function(url, onLoadRedraw) {

		if (imageCache[url] && imageCache[url].image) {

			// Reset image discard timer
			imageCache[url].keepTime = IMAGE_KEEP_TIME; 
			return imageCache[url].image;
		}
		
		var imageContainer = imageCache[url];
		
		if (imageContainer == undefined) { 
			imageCache[url] = new Object();
			imageCache[url].image = new Image();
			imageCache[url].image.onload = onLoadRedraw;
			
			imageCache[url].image.src = url;
			
			// Initialize image discard timer
			imageCache[url].keepTime = IMAGE_KEEP_TIME;
			
			imageContainer = imageCache[url];
		}
		
		return imageContainer.image;
	}
	
	// Attempt to replace the image object with a canvas buffer to solve zooming problem
	CanvasRenderer.prototype.swapCachedImage = function(url) {
		if (imageCache[url]) {
			
			if (imageCache[url].image
					&& imageCache[url].image.complete) {
				
				var image = imageCache[url].image;
				
				var buffer = document.createElement("canvas");
				buffer.width = image.width;
				buffer.height = image.height;
				
				buffer.getContext("2d").drawImage(image,
						0, 0
					);
				
				imageCache[url].image = buffer;
				imageCache[url].swappedWithCanvas = true;
				
				return buffer;
			} else {
				return null;
			} 
		} else {
			return null;
		}
	}
	
	CanvasRenderer.prototype.updateImageCaches = function() {
		
		for (var url in imageCache) {
			if (imageCache[url].keepTime <= 0) {
				
				if (imageCache[url].image != undefined) {
					imageCache[url].image.src = undefined;
					imageCache[url].image = undefined;
				}
				
				imageCache[url] = undefined;
			} else {
				imageCache[url] -= 1;
			}
		}
	}
	
	CanvasRenderer.prototype.drawImage = function(context, x, y, widthScale, heightScale, rotationCW, image) {
		
		image.widthScale = 0.5;
		image.heightScale = 0.5;
		
		image.rotate = rotationCW;
		
		var finalWidth; var finalHeight;
		
		canvas.drawImage(image, x, y);
	}
	
	// Draw edge
	CanvasRenderer.prototype.drawEdge = function(context, edge, drawOverlayInstead) {

		if( !edge.visible() ){
			return;
		}

		if( this.hideEdgesOnViewport && (this.dragData.didDrag || this.pinching || this.hoverData.dragging || this.data.wheel || this.swipePanning) ){ return; } // save cycles on pinching

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
		
		var overlayPadding = edge._private.style["overlay-padding"].value;
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
		}

		// Edge line width
		if (edge._private.style["width"].value <= 0) {
			return;
		}
		
		var edgeWidth = edge._private.style["width"].value + (drawOverlayInstead ? 2 * overlayPadding : 0);
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
			this.drawStyledEdge(edge, context, [details.startX, details.startY,
				details.cp2x, details.cp2y, details.endX, details.endY],
				lineStyle,
				edgeWidth);
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(context, edge, drawOverlayInstead);
		}

	}
	
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
	}
	
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
	}
	
	var _genEvenOddpts = function(pt, evenspac, oddspac) {
		
		pt1 = _genpts(pt, evenspac);
		pt2 = _genpts(pt, oddspac);
	}
	
	CanvasRenderer.prototype.createBuffer = function(w, h) {
		var buffer = document.createElement("canvas");
		buffer.width = w;
		buffer.height = h;
		
		return [buffer, buffer.getContext("2d")];
	}
	
	/*
	CanvasRenderer.prototype.
	
	CanvasRenderer.prototype.drawStraightEdge = function(context, x1, y1, x2, y2, type, width) {
		
		if (type == "solid") {
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);
	
			
			context.stroke();
		} else if (type == "dotted") {
			var pt = _genStraightLinePoints([x1, y1, x2, y2], 10, false);
			
			
		} else if (type == "dashed") {
			var pt = _genStraightLinePoints([x1, y1, x2, y2], 10, false);
		}
		
	}
	*/
	
	CanvasRenderer.prototype.drawStyledEdge = function(
			edge, context, pts, type, width) {
		
		// 3 points given -> assume Bezier
		// 2 -> assume straight
		
		var cy = this.data.cy;
		var zoom = cy.zoom();
		
		// Adjusted edge width for dotted
//		width = Math.max(width * 1.6, 3.4) * zoom;

		//		console.log("w", width);
		
		// from http://en.wikipedia.org/wiki/Bézier_curve#Quadratic_curves
		function qbezierAt(p0, p1, p2, t){
			return (1 - t)*(1 - t)*p0 + 2*(1 - t)*t*p1 + t*t*p2;
		}

		if( edge._private.rstyle.bezierPts === undefined ){
			edge._private.rstyle.bezierPts = [];
		}

		var nBpts = edge._private.rstyle.bezierPts.length;
		if( edge.isLoop() ){
			if( nBpts >= 12 ){
				edge._private.rstyle.bezierPts = [];
			} else {
				// append to current array
			}
		} else {
			edge._private.rstyle.bezierPts = [];
		}

		var bpts = edge._private.rstyle.bezierPts;

		if( pts.length === 6 ){
			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.05 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.05 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.25 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.25 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.35 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.35 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.65 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.65 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.75 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.75 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.95 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.95 )
			});
		}

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
	
	// Draw edge text
	CanvasRenderer.prototype.drawEdgeText = function(context, edge) {
	
		if( !edge.visible() ){
			return;
		}

		if( this.hideEdgesOnViewport && (this.dragData.didDrag || this.pinching || this.hoverData.dragging || this.data.wheel || this.swipePanning) ){ return; } // save cycles on pinching

		var computedSize = edge._private.style["font-size"].pxValue * edge.cy().zoom();
		var minSize = edge._private.style["min-zoomed-font-size"].pxValue;

		if( computedSize < minSize ){
			return;
		}
	
		// Calculate text draw position
		
		context.textAlign = "center";
		context.textBaseline = "middle";
		
		var textX, textY;	
		var edgeCenterX, edgeCenterY;
		
		if (edge._private.rscratch.edgeType == "self") {
			edgeCenterX = edge._private.rscratch.selfEdgeMidX;
			edgeCenterY = edge._private.rscratch.selfEdgeMidY;
		} else if (edge._private.rscratch.edgeType == "straight") {
			edgeCenterX = (edge._private.rscratch.startX
				+ edge._private.rscratch.endX) / 2;
			edgeCenterY = (edge._private.rscratch.startY
				+ edge._private.rscratch.endY) / 2;
		} else if (edge._private.rscratch.edgeType == "bezier") {
			edgeCenterX = 0.25 * edge._private.rscratch.startX
				+ 2 * 0.5 * 0.5 * edge._private.rscratch.cp2x
				+ (0.5 * 0.5) * edge._private.rscratch.endX;
			edgeCenterY = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startY
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2y
				+ (0.5 * 0.5) * edge._private.rscratch.endY;
		}
		
		textX = edgeCenterX;
		textY = edgeCenterY;

		// add center point to style so bounding box calculations can use it
		var rstyle = edge._private.rstyle;
		rstyle.labelX = textX;
		rstyle.labelY = textY;
		
		this.drawText(context, edge, textX, textY);
	};
	
	// Draw node
	CanvasRenderer.prototype.drawNode = function(context, node, drawOverlayInstead) {

		var nodeWidth, nodeHeight;
		
		if ( !node.visible() ) {
			return;
		}

		var parentOpacity = 1;
		var parents = node.parents();
		for( var i = 0; i < parents.length; i++ ){
			var parent = parents[i];
			var opacity = parent._private.style.opacity.value;

			parentOpacity = opacity * parentOpacity;

			if( opacity === 0 ){
				return;
			}
		}
		
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
			
			
			{
				//var image = this.getCachedImage("url");
				
				var url = node._private.style["background-image"].value[2] ||
					node._private.style["background-image"].value[1];
				
				if (url != undefined) {
					
					var r = this;
					var image = this.getCachedImage(url,
							
							function() {
								
	//							console.log(e);
								r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
								r.data.canvasRedrawReason[CanvasRenderer.NODE].push("image finished load");
								r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;
								r.data.canvasRedrawReason[CanvasRenderer.DRAG].push("image finished load");
								
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
				
			}
			
			// Border width, draw border
			if (node._private.style["border-width"].value > 0) {
				context.stroke();
			}
			

		// draw the overlay
		} else {

			var overlayPadding = node._private.style["overlay-padding"].value;
			var overlayOpacity = node._private.style["overlay-opacity"].value;
			var overlayColor = node._private.style["overlay-color"].value;
			if( overlayOpacity > 0 ){
				context.fillStyle = "rgba( " + overlayColor[0] + ", " + overlayColor[1] + ", " + overlayColor[2] + ", " + overlayOpacity + " )";

				CanvasRenderer.nodeShapes[this.getNodeShape(node)].draw(
					context,
					node._private.position.x,
					node._private.position.y,
					nodeWidth + overlayPadding * 2,
					nodeHeight + overlayPadding * 2
				);
			}
		}

	};
	
	CanvasRenderer.prototype.drawInscribedImage = function(context, img, node) {
		var r = this;
//		console.log(this.data);
		var zoom = this.data.cy._private.zoom;
		
		var nodeX = node._private.position.x;
		var nodeY = node._private.position.y;

		//var nodeWidth = node._private.style["width"].value;
		//var nodeHeight = node._private.style["height"].value;
		var nodeWidth = this.getNodeWidth(node);
		var nodeHeight = this.getNodeHeight(node);
		
		context.save();
		
		CanvasRenderer.nodeShapes[r.getNodeShape(node)].drawPath(
				context,
				nodeX, nodeY, 
				nodeWidth, nodeHeight);
		
		context.clip();
		
//		context.setTransform(1, 0, 0, 1, 0, 0);
		
		var imgDim = [img.width, img.height];
		context.drawImage(img, 
				nodeX - imgDim[0] / 2,
				nodeY - imgDim[1] / 2,
				imgDim[0],
				imgDim[1]);
		
		context.restore();
		
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
		
	};
	
	// Draw node text
	CanvasRenderer.prototype.drawNodeText = function(context, node) {
		
		if ( !node.visible() ) {
			return;
		}

		var computedSize = node._private.style["font-size"].pxValue * node.cy().zoom();
		var minSize = node._private.style["min-zoomed-font-size"].pxValue;

		if( computedSize < minSize ){
			return;
		}
	
		var textX, textY;

		//var nodeWidth = node._private.style["width"].value;
		//var nodeHeight = node._private.style["height"].value;
		var nodeWidth = this.getNodeWidth(node);
		var nodeHeight = this.getNodeHeight(node);
	
		// Find text position
		var textHalign = node._private.style["text-halign"].strValue;
		if (textHalign == "left") {
			// Align right boundary of text with left boundary of node
			context.textAlign = "right";
			textX = node._private.position.x - nodeWidth / 2;
		} else if (textHalign == "right") {
			// Align left boundary of text with right boundary of node
			context.textAlign = "left";
			textX = node._private.position.x + nodeWidth / 2;
		} else if (textHalign == "center") {
			context.textAlign = "center";
			textX = node._private.position.x;
		} else {
			// Same as center
			context.textAlign = "center";
			textX = node._private.position.x;
		}
		
		var textValign = node._private.style["text-valign"].strValue;
		if (textValign == "top") {
			context.textBaseline = "bottom";
			textY = node._private.position.y - nodeHeight / 2;
		} else if (textValign == "bottom") {
			context.textBaseline = "top";
			textY = node._private.position.y + nodeHeight / 2;
		} else if (textValign == "middle" || textValign == "center") {
			context.textBaseline = "middle";
			textY = node._private.position.y;
		} else {
			// same as center
			context.textBaseline = "middle";
			textY = node._private.position.y;
		}
		
		this.drawText(context, node, textX, textY);
	};
	
	// Draw text
	CanvasRenderer.prototype.drawText = function(context, element, textX, textY) {
	
		var parentOpacity = 1;
		var parents = element.parents();
		for( var i = 0; i < parents.length; i++ ){
			var parent = parents[i];
			var opacity = parent._private.style.opacity.value;

			parentOpacity = opacity * parentOpacity;

			if( opacity === 0 ){
				return;
			}
		}

		// Font style
		var labelStyle = element._private.style["font-style"].strValue;
		var labelSize = element._private.style["font-size"].value + "px";
		var labelFamily = element._private.style["font-family"].strValue;
		var labelVariant = element._private.style["font-variant"].strValue;
		var labelWeight = element._private.style["font-weight"].strValue;
		
		context.font = labelStyle + " " + labelWeight + " "
			+ labelSize + " " + labelFamily;
		
		var text = String(element._private.style["content"].value);
		var textTransform = element._private.style["text-transform"].value;
		
		if (textTransform == "none") {
		} else if (textTransform == "uppercase") {
			text = text.toUpperCase();
		} else if (textTransform == "lowercase") {
			text = text.toLowerCase();
		}
		
		// Calculate text draw position based on text alignment
		
		// so text outlines aren't jagged
		context.lineJoin = 'round';

		context.fillStyle = "rgba(" 
			+ element._private.style["color"].value[0] + ","
			+ element._private.style["color"].value[1] + ","
			+ element._private.style["color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value * parentOpacity) + ")";
		
		context.strokeStyle = "rgba(" 
			+ element._private.style["text-outline-color"].value[0] + ","
			+ element._private.style["text-outline-color"].value[1] + ","
			+ element._private.style["text-outline-color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value * parentOpacity) + ")";
		
		if (text != undefined) {
			var lineWidth = 2  * element._private.style["text-outline-width"].value; // *2 b/c the stroke is drawn centred on the middle
			if (lineWidth > 0) {
				context.lineWidth = lineWidth;
				context.strokeText(text, textX, textY);
			}

			// Thanks sysord@github for the isNaN checks!
			if (isNaN(textX)) { textX = 0; }
			if (isNaN(textY)) { textY = 0; }

			context.fillText("" + text, textX, textY);

			// record the text's width for use in bounding box calc
			element._private.rstyle.labelWidth = context.measureText( text ).width;
		}
	};

	CanvasRenderer.prototype.drawBackground = function(context, color1, color2, 
			startPosition, endPosition) {
	
		
	}
	
	// @O Edge calculation functions
	{
	
	// Find edge control points
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var hashTable = {}; var cy = this.data.cy;
		var pairIds = [];
		
		var pairId;
		for (var i = 0; i < edges.length; i++){

			// ignore edges who are not to be displayed
			// they shouldn't take up space
			if( edges[i]._private.style.display.value === 'none' ){
				continue;
			}

			pairId = edges[i]._private.data.source > edges[i]._private.data.target ?
				edges[i]._private.data.target + '-' + edges[i]._private.data.source :
				edges[i]._private.data.source + '-' + edges[i]._private.data.target ;

			if (hashTable[pairId] == undefined) {
				hashTable[pairId] = [];
			}
			
			hashTable[pairId].push( edges[i] );
			pairIds.push( pairId );
		}
		var src, tgt;
		
		// Nested for loop is OK; total number of iterations for both loops = edgeCount	
		for (var p = 0; p < pairIds.length; p++) {
			pairId = pairIds[p];
		
			src = cy.getElementById( hashTable[pairId][0]._private.data.source );
			tgt = cy.getElementById( hashTable[pairId][0]._private.data.target );

			var midPointX = (src._private.position.x + tgt._private.position.x) / 2;
			var midPointY = (src._private.position.y + tgt._private.position.y) / 2;
			
			var displacementX, displacementY;
			
			if (hashTable[pairId].length > 1) {
				displacementX = tgt._private.position.y - src._private.position.y;
				displacementY = src._private.position.x - tgt._private.position.x;
				
				var displacementLength = Math.sqrt(displacementX * displacementX
					+ displacementY * displacementY);
				
				displacementX /= displacementLength;
				displacementY /= displacementLength;
			}
			
			var edge;
			
			for (var i = 0; i < hashTable[pairId].length; i++) {
				edge = hashTable[pairId][i];
				
				var edgeIndex1 = edge._private.rscratch.lastEdgeIndex;
				var edgeIndex2 = i;

				var numEdges1 = edge._private.rscratch.lastNumEdges;
				var numEdges2 = hashTable[pairId].length;

				var srcX1 = edge._private.rscratch.lastSrcCtlPtX;
				var srcX2 = src._private.position.x;
				var srcY1 = edge._private.rscratch.lastSrcCtlPtY;
				var srcY2 = src._private.position.y;
				var srcW1 = edge._private.rscratch.lastSrcCtlPtW;
				var srcW2 = src.outerWidth();
				var srcH1 = edge._private.rscratch.lastSrcCtlPtH;
				var srcH2 = src.outerHeight();

				var tgtX1 = edge._private.rscratch.lastTgtCtlPtX;
				var tgtX2 = tgt._private.position.x;
				var tgtY1 = edge._private.rscratch.lastTgtCtlPtY;
				var tgtY2 = tgt._private.position.y;
				var tgtW1 = edge._private.rscratch.lastTgtCtlPtW;
				var tgtW2 = tgt.outerWidth();
				var tgtH1 = edge._private.rscratch.lastTgtCtlPtH;
				var tgtH2 = tgt.outerHeight();

				if( srcX1 === srcX2 && srcY1 === srcY2 && srcW1 === srcW2 && srcH1 === srcH2
				&&  tgtX1 === tgtX2 && tgtY1 === tgtY2 && tgtW1 === tgtW2 && tgtH1 === tgtH2
				&&  edgeIndex1 === edgeIndex2 && numEdges1 === numEdges2 ){
					// console.log('edge ctrl pt cache HIT')
					continue; // then the control points haven't changed and we can skip calculating them
				} else {
					var rs = edge._private.rscratch;

					rs.lastSrcCtlPtX = srcX2;
					rs.lastSrcCtlPtY = srcY2;
					rs.lastSrcCtlPtW = srcW2;
					rs.lastSrcCtlPtH = srcH2;
					rs.lastTgtCtlPtX = tgtX2;
					rs.lastTgtCtlPtY = tgtY2;
					rs.lastTgtCtlPtW = tgtW2;
					rs.lastTgtCtlPtH = tgtH2;
					rs.lastEdgeIndex = edgeIndex2;
					rs.lastNumEdges = numEdges2;
					// console.log('edge ctrl pt cache MISS')
				}

				// Self-edge
				if (src._private.data.id == tgt._private.data.id) {
					var stepSize = edge._private.style["control-point-step-size"].pxValue;
						
					edge._private.rscratch.edgeType = "self";
					
					// New -- fix for large nodes
					edge._private.rscratch.cp2ax = src._private.position.x;
					edge._private.rscratch.cp2ay = src._private.position.y
						- (1 + Math.pow(this.getNodeHeight(src), 1.12) / 100) * stepSize * (i / 3 + 1);
					
					edge._private.rscratch.cp2cx = src._private.position.x
						- (1 + Math.pow(this.getNodeWidth(src), 1.12) / 100) * stepSize * (i / 3 + 1);
					edge._private.rscratch.cp2cy = src._private.position.y;
					
					edge._private.rscratch.selfEdgeMidX =
						(edge._private.rscratch.cp2ax + edge._private.rscratch.cp2cx) / 2.0;
				
					edge._private.rscratch.selfEdgeMidY =
						(edge._private.rscratch.cp2ay + edge._private.rscratch.cp2cy) / 2.0;
					
				// Straight edge
				} else if (hashTable[pairId].length % 2 == 1
					&& i == Math.floor(hashTable[pairId].length / 2)) {
					
					edge._private.rscratch.edgeType = "straight";
					
				// Bezier edge
				} else {
					var stepSize = edge._private.style["control-point-step-size"].value;
					var distanceFromMidpoint = (0.5 - hashTable[pairId].length / 2 + i) * stepSize;
					
					edge._private.rscratch.edgeType = "bezier";
					
					edge._private.rscratch.cp2x = midPointX
						+ displacementX * distanceFromMidpoint;
					edge._private.rscratch.cp2y = midPointY
						+ displacementY * distanceFromMidpoint;
					
					// console.log(edge, midPointX, displacementX, distanceFromMidpoint);
				}
			}
		}
		
		return hashTable;
	}

	CanvasRenderer.prototype.findEndpoints = function(edge) {
		var intersect;

		var source = edge.source()[0];
		var target = edge.target()[0];
		
//		var sourceRadius = Math.max(edge.source()[0]._private.style["width"].value,
//			edge.source()[0]._private.style["height"].value);

		var sourceRadius = Math.max(this.getNodeWidth(source),
			this.getNodeHeight(source));
		
//		var targetRadius = Math.max(edge.target()[0]._private.style["width"].value,
//			edge.target()[0]._private.style["height"].value);

		var targetRadius = Math.max(this.getNodeWidth(target),
			this.getNodeHeight(target));

		sourceRadius = 0;
		targetRadius /= 2;
		
		var start = [edge.source().position().x, edge.source().position().y];
		var end = [edge.target().position().x, edge.target().position().y];
		
		if (edge._private.rscratch.edgeType == "self") {
			
			var cp = [edge._private.rscratch.cp2cx, edge._private.rscratch.cp2cy];
			
			intersect = CanvasRenderer.nodeShapes[this.getNodeShape(target)].intersectLine(
				target._private.position.x,
				target._private.position.y,
				//target._private.style["width"].value,
				//target._private.style["height"].value,
				this.getNodeWidth(target),
				this.getNodeHeight(target),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				target._private.style["border-width"].value / 2
			);
			
			var arrowEnd = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			var cp = [edge._private.rscratch.cp2ax, edge._private.rscratch.cp2ay];

			intersect = CanvasRenderer.nodeShapes[this.getNodeShape(source)].intersectLine(
				source._private.position.x,
				source._private.position.y,
				//source._private.style["width"].value,
				//source._private.style["height"].value,
				this.getNodeWidth(source),
				this.getNodeHeight(source),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				source._private.style["border-width"].value / 2
			);
			
			var arrowStart = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.edgeType == "straight") {
		
			intersect = CanvasRenderer.nodeShapes[this.getNodeShape(target)].intersectLine(
				target._private.position.x,
				target._private.position.y,
				//target._private.style["width"].value,
				//target._private.style["height"].value,
				this.getNodeWidth(target),
				this.getNodeHeight(target),
				source.position().x,
				source.position().y,
				target._private.style["border-width"].value / 2);
				
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			var arrowEnd = $$.math.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				CanvasRenderer.arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = $$.math.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				CanvasRenderer.arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));

			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
		
			intersect = CanvasRenderer.nodeShapes[this.getNodeShape(source)].intersectLine(
				source._private.position.x,
				source._private.position.y,
				//source._private.style["width"].value,
				//source._private.style["height"].value,
				this.getNodeWidth(source),
				this.getNodeHeight(source),
				target.position().x,
				target.position().y,
				source._private.style["border-width"].value / 2);
			
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			/*
			console.log("1: "
				+ CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowStart = $$.math.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = $$.math.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));

			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
						
		} else if (edge._private.rscratch.edgeType == "bezier") {
			
			var cp = [edge._private.rscratch.cp2x, edge._private.rscratch.cp2y];
			
			// Point at middle of Bezier
			var halfPointX = start[0] * 0.25 + end[0] * 0.25 + cp[0] * 0.5;
			var halfPointY = start[1] * 0.25 + end[1] * 0.25 + cp[1] * 0.5;
			
			intersect = CanvasRenderer.nodeShapes[
				this.getNodeShape(target)].intersectLine(
				target._private.position.x,
				target._private.position.y,
				//target._private.style["width"].value,
				//target._private.style["height"].value,
				this.getNodeWidth(target),
				this.getNodeHeight(target),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				target._private.style["border-width"].value / 2
			);
			
			/*
			console.log("2: "
				+ CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowEnd = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			intersect = CanvasRenderer.nodeShapes[
				this.getNodeShape(source)].intersectLine(
				source._private.position.x,
				source._private.position.y,
				//source._private.style["width"].value,
				//source._private.style["height"].value,
				this.getNodeWidth(source),
				this.getNodeHeight(source),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				source._private.style["border-width"].value / 2
			);
			
			var arrowStart = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = $$.math.shortenIntersection(intersect, cp,
				CanvasRenderer.arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isArcEdge) {
			return;
		}
	}

	}

	// @O Graph traversal functions
	{
	
	// Find adjacent edges
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = this.getCachedEdges();
		
		var hashTable = {};
		var adjacentEdges = [];
		
		for (var i = 0; i < nodeSet.length; i++) {
			hashTable[nodeSet[i]._private.data.id] = nodeSet[i];
		}
		
		for (var i = 0; i < edges.length; i++) {
			if (hashTable[edges[i]._private.data.source]
				|| hashTable[edges[i]._private.data.target]) {
				
				adjacentEdges.push(edges[i]);
			}
		}
		
		return adjacentEdges;
	}
	
	}
	
	// @O Arrow shapes
	{
	
	
	
	// @O Arrow shape sizing (w + l)
	{
	
	CanvasRenderer.prototype.getArrowWidth = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	CanvasRenderer.prototype.getArrowHeight = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	}
	
	// @O Arrow shape drawing
	
	// Draw arrowheads on edge
	CanvasRenderer.prototype.drawArrowheads = function(context, edge, drawOverlayInstead) {
		if( drawOverlayInstead ){ return; } // don't do anything for overlays 

		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		dispX = startX - edge.source().position().x;
		dispY = startY - edge.source().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["source-arrow-color"].value[0] + ","
			+ edge._private.style["source-arrow-color"].value[1] + ","
			+ edge._private.style["source-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["source-arrow-shape"].value, 
			startX, startY, dispX, dispY);
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		dispX = endX - edge.target().position().x;
		dispY = endY - edge.target().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["target-arrow-color"].value[0] + ","
			+ edge._private.style["target-arrow-color"].value[1] + ","
			+ edge._private.style["target-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["target-arrow-shape"].value,
			endX, endY, dispX, dispY);
	}
	
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
	}

	}
	
	
	// @O Polygon drawing
	CanvasRenderer.prototype.drawPolygonPath = function(
		context, x, y, width, height, points) {

		//context.save();
		

		context.translate(x, y);
		context.scale(width / 2, height / 2);

		context.beginPath();

		context.moveTo(points[0], points[1]);

		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		
		context.scale(2/width, 2/height);
		context.translate(-x, -y);
		// context.restore();
	}
	
	CanvasRenderer.prototype.drawPolygon = function(
		context, x, y, width, height, points) {

		// Draw path
		this.drawPolygonPath(context, x, y, width, height, points);
		
		// Fill path
		context.fill();
	}
	
	// Round rectangle drawing
	CanvasRenderer.prototype.drawRoundRectanglePath = function(
		context, x, y, width, height, radius) {
		
		var halfWidth = width / 2;
		var halfHeight = height / 2;
		var cornerRadius = $$.math.getRoundRectangleRadius(width, height);
		context.translate(x, y);
		
		context.beginPath();
		
		// Start at top middle
		context.moveTo(0, -halfHeight);
		// Arc from middle top to right side
		context.arcTo(halfWidth, -halfHeight, halfWidth, 0, cornerRadius);
		// Arc from right side to bottom
		context.arcTo(halfWidth, halfHeight, 0, halfHeight, cornerRadius);
		// Arc from bottom to left side
		context.arcTo(-halfWidth, halfHeight, -halfWidth, 0, cornerRadius);
		// Arc from left side to topBorder
		context.arcTo(-halfWidth, -halfHeight, 0, -halfHeight, cornerRadius);
		// Join line
		context.lineTo(0, -halfHeight);
		
		/*
		void arc(unrestricted double x, 
				 unrestricted double y, 
				 unrestricted double radius, 
				 unrestricted double startAngle, 
				 unrestricted double endAngle, 
				 optional boolean anticlockwise = false);
		*/
		/*
		context.arc(-width / 2 + cornerRadius,
					-height / 2 + cornerRadius,
					cornerRadius,
					0,
					Math.PI * 2 * 0.999);
		*/
		
		context.closePath();
		
		context.translate(-x, -y);
	}
	
	CanvasRenderer.prototype.drawRoundRectangle = function(
		context, x, y, width, height, radius) {
		
		this.drawRoundRectanglePath(context, x, y, width, height, radius);
		
		context.fill();
	}

	
	}

	// copy the math functions into the renderer prototype
	// unfortunately these functions are used interspersed t/o the code
	// and this makes sure things work just in case a ref was missed in refactoring
	// TODO remove this eventually
	for( var fnName in $$.math ){
		CanvasRenderer.prototype[ fnName ] = $$.math[ fnName ];
	}
	
	
	var debug = function(){};
	$$("renderer", "canvas", CanvasRenderer);
	
})( cytoscape );