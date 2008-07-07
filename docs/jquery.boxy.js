// Boxy - Facebook-style dialog, with frills
// (c) 2008 Jason Frame

// TODO: multi-select list
// TODO: allow resizing when not visible
// BUG: modal dialog blackout doesn't resize when window resizes

//
// jQuery Plugin

// single - only show a single instance at a time (default: true)
// cache - if true, data retrieved from AJAX calls will be cached. Inline data
//         will always be cached as we need to stash it someplace outside the DOM
//         to avoid having multiple elements with the same ID.
// message - confirmation message for form submit hook (default: "Please confirm:")
// method - AJAX method to use for loading remote content (default: GET)
// (any leftover options - e.g. 'clone' - will be passed onto the boxy constructor)
jQuery.fn.boxy = function(options) {
    options = jQuery.extend({single: true}, options || {});
    this.each(function() {      
        var node = this.nodeName.toLowerCase(), self = this;
        if (node == 'a') {
            jQuery(this).click(function() {
                var anchor = this,
                    href = this.getAttribute('href'),
                    realOpts = jQuery.extend(options, {title: this.title});
                    
                var loadContent = function(after) {
                    if (Boxy.cache[href]) {
                        after(Boxy.cache[href].clone());   
                    } else if (href.indexOf('#') >= 0) {
                        href = href.substr(href.indexOf('#'));
                        Boxy.cache[href] = jQuery(href).remove();
                        after(Boxy.cache[href].clone());
                    } else { // fall back to AJAX; could do with a same-origin check
                        jQuery.ajax({
                            url: anchor.href,
                            method: options.method || 'GET',
                            dataType: 'html',
                            data: {__math__: Math.random()},
                            success: function(data) {
                                data = jQuery(data);
                                if (options.cache) {
                                    Boxy.cache[href] = data;
                                    data = data.clone();
                                }
                                after(data);
                            }
                        });
                    }
                };
                
                var active;
                if (options.single && (active = jQuery.data(this, 'active.boxy'))) {
                    loadContent(function(content) {
                        active.setContent(content).center().show();     
                    });
                } else {
                    loadContent(function(content) {
                        jQuery.data(anchor, 'active.boxy', new Boxy(content, realOpts));     
                    });
                }
                
                return false;
            });
        } else if (node == 'form') {
            jQuery(this).bind('submit.boxy', function() {
                Boxy.ask(options.message || 'Please confirm:', ['OK', 'Cancel'], function(v) {
                    if (v == 'OK') {
                        jQuery(self).unbind('submit.boxy').submit();
                    }
                }, {modal: true, closeable: false});
                return false;
            });
        }
    });
};

//
// Boxy Class

function Boxy(element, options) {
    
    this.boxy = jQuery(this.WRAPPER);
    jQuery.data(this.boxy[0], 'boxy', this);
    
    this.visible = false;
    this.options = jQuery.extend({
        title: null, closeable: true, draggable: true, clone: false,
        center: true, show: true, modal: false, fixed: true
    }, options || {});
    
    if (this.options.modal) {
        this.options = jQuery.extend(this.options, {center: true, draggable: false});
    }
    
    this.setContent(element || "<div></div>");
    this._setupTitleBar();
    this._setupBehaviours();
    
    this.boxy.css('display', 'none').appendTo(document.body);
    this.toTop();

    if (this.options.fixed) {
      if (jQuery.browser.msie && jQuery.browser.version < 7) {
        this.options.fixed = false; // IE6 doesn't support fixed positioning
      } else {
        this.boxy.addClass('fixed');
      }
    }
    
    if (this.options.center
        && typeof this.options.x == 'undefined'
        && typeof this.options.y == 'undefined') {
        this.center();
    } else {
        this.moveTo(this.options.x || Boxy.DEFAULT_X,
                    this.options.y || Boxy.DEFAULT_Y);
    }
    
    if (this.options.show) this.show();

};

jQuery.extend(Boxy, {
    DEFAULT_X:          50,
    DEFAULT_Y:          50,
    cache:              {},
    zIndex:             1337,
    dragConfigured:     false, // only set up one drag handler for all boxys
    dragging:           null,
    
    // allows you to get a handle to the containing boxy instance of any element
    // e.g. <a href='#' onclick='alert(Boxy.get(this));'>inspect!</a>.
    // this returns the actual instance of the boxy 'class', not just a DOM element.
    // Boxy.get(this).hide() would be valid, for instance.
    get: function(ele) {
        var p = jQuery(ele).parents('.boxy-wrapper');
        return p.length ? jQuery.data(p[0], 'boxy') : null;
    },
    
    // asks a question with multiple responses presented as buttons
    // selected item is returned to a callback method.
    // answers may be either an array or a hash. if it's an array, the
    // the callback will received the selected value. if it's a hash,
    // you'll get the corresponding key.
    ask: function(question, answers, callback, options) {
        
        options = jQuery.extend({modal: true, closeable: false}, options, {show: true});
        
        var body = jQuery('<div></div>').append(jQuery('<div class="question"></div>').html(question));
        
        // ick
        var map = {}, answerStrings = [];
        if (answers instanceof Array) {
            for (var i = 0; i < answers.length; i++) {
                map[answers[i]] = answers[i];
                answerStrings.push(answers[i]);
            }
        } else {
            for (var k in answers) {
                map[answers[k]] = k;
                answerStrings.push(answers[k]);
            }
        }
        
        var buttons = jQuery('<form class="answers"></form>');
        buttons.html(jQuery.map(answerStrings, function(v) {
            return "<input type='button' value='" + v + "' />";
        }).join(' '));
        
        jQuery('input[type=button]', buttons).click(function() {
            var clicked = this;
            Boxy.get(this).hide(function() {
                if (callback) callback(map[clicked.value]);
            });
        });
        
        body.append(buttons);
        
        new Boxy(body, options);
        
    },
    
    _handleDrag: function(evt) {
        var d;
        if (d = Boxy.dragging) {
            d[0].boxy.css({left: evt.pageX - d[1], top: evt.pageY - d[2]});
        }
    },
    
    _nextZ: function() {
        return Boxy.zIndex++;
    }
});

Boxy.prototype = {
    
    WRAPPER:    "<table cellspacing='0' cellpadding='0' border='0' class='boxy-wrapper'>" +
                    "<tr><td class='top-left'></td><td class='top'></td><td class='top-right'></td></tr>" +
                    "<tr><td class='left'></td><td class='boxy-inner'></td><td class='right'></td></tr>" +
                    "<tr><td class='bottom-left'></td><td class='top'></td><td class='bottom-right'></td></tr>" +
                "</table>",
    
    // Returns the size of this boxy instance without displaying it.
    // Do not use this method if boxy is already visible, use getSize() instead.
    estimateSize: function() {
        this.boxy.css('display', 'none')
                 .css({top: 0, left: 0, visibility: 'hidden'})
                 .css('display', 'block');
        var dims = this.getSize();
        this.boxy.css('display', 'none').css('visibility', 'visible');
        return dims;
    },
                
    // Returns the dimensions of the entire boxy dialog as [width,height]
    getSize: function() {
        return [this.boxy.width(), this.boxy.height()];
    },
    
    // Returns the dimensions of the content region as [width,height]
    getContentSize: function() {
        var c = this.getContent();
        return [c.width(), c.height()];
    },
    
    // Returns the position of this dialog as [x,y]
    getPosition: function() {
        var b = this.boxy[0];
        return [b.offsetLeft, b.offsetTop];
    },
    
    // Returns the center point of this dialog as [x,y]
    getCenter: function() {
        var p = this.getPosition();
        var s = this.getSize();
        return [Math.floor(p[0] + s[0] / 2), Math.floor(p[1] + s[1] / 2)];
    },
                
    // Returns a jQuery object wrapping the inner boxy region.
    // Not much reason to use this, you're probably more interested in getContent()
    getInner: function() {
        return jQuery('.boxy-inner', this.boxy);
    },
    
    // Returns a jQuery object wrapping the boxy content region.
    // This is the user-editable content area (i.e. excludes titlebar)
    getContent: function() {
        return jQuery('.boxy-content', this.boxy);
    },
    
    // Replace dialog content
    setContent: function(newContent) {
        newContent = jQuery(newContent).css({display: 'block'}).addClass('boxy-content');
        if (this.options.clone) newContent = newContent.clone();   
        var content = this.getContent();
        if (content.length) {
            content.replaceWith(newContent);   
        } else {
            this.getInner().append(newContent);
        }
        return this;
    },
    
    // Move this dialog to some position, funnily enough
    moveTo: function(x, y) {
        this.boxy.css({left: x, top: y});
        return this;
    },
    
    // Move this dialog so that it is centered at x,y
    centerAt: function(x, y) {
        if (this.visible) {
            var s = this.getSize();
        } else {
            var s = this.estimateSize();
        }
        this.moveTo(x - s[0] / 2, y - s[1] / 2);
        return this;
    },
    
    // Center this dialog in the viewport
    center: function() {
        if (this.options.fixed) {
          var s = [0,0];
        } else {
          var s = jQuery.browser.msie ? [document.documentElement.scrollLeft, document.documentElement.scrollTop]
                               : [window.pageXOffset, window.pageYOffset];
        }
        var v = [s[0], s[1], jQuery(window).width(), jQuery(window).height()];
        this.centerAt((v[0] + v[2] / 2), (v[1] + v[3] / 2));
        return this;
    },
    
    // Resize the content region to a specific size
    resize: function(width, height, after) {
        if (!this.visible) return;
        var bounds = this._getBoundsForResize(width, height);
        this.boxy.css({left: bounds[0], top: bounds[1]});
        this.getContent().css({width: bounds[2], height: bounds[3]});
        if (after) after(this);
        return this;
    },
    
    // Tween the content region to a specific size
    tween: function(width, height, after) {
        if (!this.visible) return;
        var bounds = this._getBoundsForResize(width, height);
        var self = this;
        this.boxy.stop().animate({left: bounds[0], top: bounds[1]});
        this.getContent().stop().animate({width: bounds[2], height: bounds[3]}, function() {
            if (after) after(self);
        });
        return this;
    },
    
    isVisible: function() {
        return this.visible;    
    },
    
    // Make this boxy instance visible
    show: function() {
        if (this.visible) return;
        if (this.options.modal) {
            jQuery('<div class="boxy-modal-blackout"></div>')
                .css({zIndex: Boxy._nextZ(),
                      width: jQuery(document).width(),
                      height: jQuery(document).height()})
                .appendTo(document.body);
            this.toTop();
        }
        this.boxy.stop().css({opacity: 1, display: 'block'});
        this.visible = true;
        return this;
    },
    
    // Hide this boxy instance
    hide: function(after) {
        if (!this.visible) return;
        var self = this;
        if (this.options.modal) {
            jQuery('.boxy-modal-blackout').animate({opacity: 0}, function() {
                jQuery(this).remove();
            });
        }
        this.boxy.stop().animate({opacity: 0}, 300, function() {
            self.boxy.css({display: 'none'});
            self.visible = false;
            if (after) after(self);
        });
        return this;
    },
    
    // Move this dialog box above all other boxy instances
    toTop: function() {
        this.boxy.css({zIndex: Boxy._nextZ()});
        return this;
    },
    
    //
    // Don't touch these privates
    
    _getBoundsForResize: function(width, height) {
        var csize = this.getContentSize();
        var delta = [width - csize[0], height - csize[1]];
        var p = this.getPosition();
        return [Math.max(p[0] - delta[0] / 2, 0),
                Math.max(p[1] - delta[1] / 2, 0), width, height];
    },
    
    _setupTitleBar: function() {
        if (this.options.title) {
            var self = this;
            var tb = jQuery("<div class='title-bar'></div>").html(this.options.title);
            if (this.options.closeable) {
                tb.append(jQuery("<a href='#' class='close'></a>").html("[close]"));
            }
            if (this.options.draggable) {
                if (!Boxy.dragConfigured) {
                    jQuery(document).mousemove(Boxy._handleDrag);
                    Boxy.dragConfigured = true;
                }
                tb.mousedown(function(evt) {
                    self.toTop();
                    Boxy.dragging = [self, evt.pageX - self.boxy[0].offsetLeft, evt.pageY - self.boxy[0].offsetTop];
                    jQuery(this).addClass('dragging');
                });
                tb.mouseup(function() {
                    jQuery(this).removeClass('dragging');
                    Boxy.dragging = null;
                });
            }
            this.getInner().prepend(tb);
        }
    },
    
    _setupBehaviours: function() {
        var self = this;
        jQuery('.close', this.boxy).click(function() {
            self.hide();
            return false;
        }).mousedown(function(evt) { evt.stopPropagation(); });
    }
    
};
