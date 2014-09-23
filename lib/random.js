/**
 * This file is part of foograph Javascript graph library.
 *
 * Description: Random vertex layout manager
 */

/**
 * Class constructor.
 *
 * @param width Layout width
 * @param height Layout height
 */
function RandomVertexLayout(width, height)
{
  this.width = width;
  this.height = height;
}

/**
 * Calculates the coordinates based on pure chance.
 *
 * @param graph A valid graph instance
 */
RandomVertexLayout.prototype.layout = function(graph)
{
  for (var i = 0; i<graph.vertices.length; i++) {
    var v = graph.vertices[i];
    v.x = Math.round(Math.random() * this.width);
    v.y = Math.round(Math.random() * this.height);
  }
}
