module.exports = 
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.webkitRequestAnimationFrame;