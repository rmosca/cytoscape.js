;(function($$){ 'use strict';

	var CanvasRenderer = $$('renderer', 'canvas');
	var annotationShapes = CanvasRenderer.annotationShapes = {};

	// Contract for annotation shapes:
	// 0, 0 is the center

	 annotationShapes["circle"] = {
	     _baseRadius: 1.0,
	     draw: function(context) {
	       context.arc(0, 0, annotationShapes["circle"]._baseRadius, 0, Math.PI * 2, false);
	     }
	   }

	annotationShapes["triangle"] = {
		_points: [
			-0.82, -1.00,
			 0.90,  0.00,
			-0.82,  1.00
		],
		draw: function(context) {
			var points = annotationShapes["triangle"]._points;
		
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		}
	}
	
	
	annotationShapes["square"] = {
		_points: [
			-0.90, -0.90,
			 0.90, -0.90,
			 0.90,  0.90,
			-0.90,  0.90
		],
		draw: function(context) {
			var points = annotationShapes["square"]._points;
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		}
	}
	
	annotationShapes["diamond"] = {
		_points: [
			 0.00, -1.06,
			 1.06,  0.00,
			 0.00,  1.06,
		  -1.06,  0.00
		],
		draw: function(context) {
      var points = annotationShapes["diamond"]._points;
      for (var i = 0; i < points.length / 2; i++) {
        context.lineTo(points[i * 2], points[i * 2 + 1]);
      }
		}
	}

  annotationShapes["roundsquare"] = {
    _halfWidth: 0.9,
    draw: function(context) {
      var halfWidth = annotationShapes["roundsquare"]._halfWidth;
      var cornerRadius = $$.math.getRoundRectangleRadius(2*halfWidth,2*halfWidth);

      context.beginPath();
      // Start at top middle
      context.moveTo(0, -halfWidth);
      // Arc from middle top to right side
      context.arcTo(halfWidth, -halfWidth, halfWidth, 0, cornerRadius);
      // Arc from right side to bottom
      context.arcTo(halfWidth, halfWidth, 0, halfWidth, cornerRadius);
      // Arc from bottom to left side
      context.arcTo(-halfWidth, halfWidth, -halfWidth, 0, cornerRadius);
      // Arc from left side to topBorder
      context.arcTo(-halfWidth, -halfWidth, 0, -halfWidth, cornerRadius);
      // Join line
      context.lineTo(0, -halfWidth);
      context.closePath();
    }
  }

})( cytoscape );