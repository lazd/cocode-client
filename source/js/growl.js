var Growl = module.exports = function(message, options) {
  options = options || {};

  var container = options.container = options.container || document.getElementById('cc-Growls');
  options.timeout = options.timeout || 4000;

  this.destroy = this.destroy.bind(this);

  var el = this.el = document.createElement('div');
  this.el.className = 'cc-Growl'; // No need for u-fades, growl has additional transitions
  this.el.innerHTML = message;

  // Insert so we can measure stuff
  options.container.insertBefore(this.el, options.container.firstChild);

  // Compute the margin of a growl
  var style = window.getComputedStyle(el, null);
  var margin = parseInt(style.getPropertyValue('margin-top')) + parseInt(style.getPropertyValue('margin-bottom'));

  // Sum the height of everyone in the container
  var top = 0;
  for (var i = 1; i < container.children.length; i++) {
    top += container.children[i].offsetHeight + margin;
  }

  this.el.style.top = top + 'px';
  this.el.style.right = 0;

  // Start fading in later so the CSS animation is triggered
  setTimeout(function() {
    el.classList.add('u-fadeIn');
  }, 0);

  // Go away after timeout
  if (options.timeout) {
    this.timeout = setTimeout(this.destroy, options.timeout);
  }

  // Go away if clicked
  this.el.addEventListener('click', this.destroy);
};

Growl.prototype.destroy = function() {
  var self = this;
  clearTimeout(this.timeout);

  // Start fade
  this.el.classList.remove('u-fadeIn');
  this.el.classList.add('u-fadeOut');

  // Animate slide out
  this.el.style.right = '';

  // Destroy after 0.5s
  setTimeout(function() {
    if (self.el && self.el.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
    self.el = null;
  }, 500);
};
