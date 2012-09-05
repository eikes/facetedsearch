// Models
var Item = Backbone.Model.extend({
  defaults: function() {
    return {
      "__visible__": true
    };
  }
});
var ItemList = Backbone.Collection.extend({
  model: Item,
  getVisible: function() {
    return this.filter(function(item){ 
      return item.get('__visible__'); 
    });
  }
});
var FacetItem = Backbone.Model.extend({
  defaults: function() {
    return {
      "active"    : false,
      "count"     : 0,
      "name"      : ""
    };
  },
  toggle: function() {
    this.set({"active": !this.get("active")});
  },
  inc: function() {
    this.set({"count": (this.get("count")+1)}, {silent: true});
  }
});
var Facet = Backbone.Collection.extend({
  model: FacetItem,
  hasActive: function() {
    return this.any(function(facetItem){
      return facetItem.get("active");
    });
  }
});
var FacetedSearch = Backbone.Model.extend({
  update: function() {
    this.updateVisibleItems.call(this);
    this.updateFacetCount.call(this);
  },
  updateVisibleItems: function() {
    var _this = this;
    var visible, facetApplies, facetValue, facetName, itemValue;
    this.get("items").each(function(item) {
      visible = true;
      facetApplies = false;
      _.each(_this.get("facets"), function(facet){
        facetApplies = facet.any(function(facetItem){
          if (facetItem.get("active")) {
            facetName = facetItem.collection.facetName;
            facetValue = facetItem.get("name");
            itemValue = item.get(facetName);
            if (_.isString(itemValue)) {
              return itemValue == facetValue;
            } else if (_.isArray(itemValue)) {
              return _.indexOf(itemValue, facetValue) != -1;
            }
          }
        });
        if (facet.hasActive() && !facetApplies) {
          visible = false;
        }
      });
      if (item.get("__visible__") != visible) {
        item.set({"__visible__": visible});
      }
    });
  },
  updateFacetCount: function() {
    var _this = this;
    var facetActive, facetValue, facetName, itemValue;
    _.each(_this.get("facets"), function(facet){
      facet.each(function(facetItem){
        facetItem.set({count: 0}, {silent: true});
      });
    });
    this.get("items").each(function(item){
      if (item.get("__visible__")) {
        _.each(_this.get("facets"), function(facet){
          facetActive = facet.hasActive();
          facet.each(function(facetItem) {
            if (!facetActive || facetItem.get("active")) {
              facetValue = facetItem.get("name");
              facetName = facetItem.collection.facetName;
              itemValue = item.get(facetName);
              if (_.isString(itemValue)) {
                if (itemValue == facetValue) {
                  facetItem.inc();
                }
              } else if (_.isArray(itemValue)) {
                if (_.indexOf(itemValue, facetValue) != -1) {
                  facetItem.inc();
                }
              } 
            }
          });
        });
      }
    });
    _.each(_this.get("facets"), function(facet){
      facet.each(function(facetItem) {
        facetItem.trigger("change:count");
      });
    });
  },
  initialize: function(options) {
    // Find all items and convert them into Models in a Collection
    var items = new ItemList(_.map(options.items, function(item) { 
      return new Item(item);
    }));
    this.set("items", items);
    // Find and create all Facets and FacetItems
    var _this = this;
    var facets= _.map(options.facets, function(facetDisplayName, facetName) {
      var listOfFacetItemNames = _.uniq(_.flatten(_this.get("items").pluck(facetName)));
      var facet = new Facet(_.map(listOfFacetItemNames, function(facetItemName){
        return new FacetItem({name: facetItemName});
      }));
      facet.on("change:active", _this.update, _this);
      // This is not quite by the book, but the collection needs to know its name...
      facet.facetName = facetName;
      facet.facetDisplayName = facetDisplayName;
      return facet;
    });
    this.set("facets", facets);
    this.update();
  }
});

// Views
var ItemView = Backbone.View.extend({
  initialize: function() {
    this.model.on("change:__visible__", function() {
      this.el.style.display = this.model.get("__visible__") ? "" : "none";
    }, this);
  },
  className: "item",
  render: function() {
    var html = this.model.collection.itemTemplate(this.model.attributes);
    this.$el.html(html);
  }
});
var ItemsView = Backbone.View.extend({
  initialize: function(options) {
    this.collection.itemTemplate = _.template(options.itemTemplate);
  },
  render: function() {
    var _this = this;
    var itemView;
    this.collection.map(function(item, position) {
      itemView = new ItemView({
        model: item
      });
      itemView.render();
      _this.$el.append(itemView.el);
    });
  }
});
var FacetItemView = Backbone.View.extend({
  initialize: function(){
    var _this = this;
    this.model.on("change:active", this.updateActive, this);
    this.model.on("change:count", function() {
      _this.render();
    });
  },
  updateActive: function() {
    if (this.model.get("active")) {
      this.$el.addClass("activefacet");
    } else {
      this.$el.removeClass("activefacet");
    }
  },
  className: "facetitem",
  events: {
    "click": function(){
      this.model.toggle();
    }
  },
  render: function() {
    this.$el.html(this.options.facetItemTemplateFunction({
      name: this.model.get("name"),
      count: this.model.get("count"),
    }));
    this.updateActive();
  }
});
var FacetView = Backbone.View.extend({
  className: "facet",
  render: function() {
    var _this = this;
    this.$el.html(this.options.facetTemplateFunction({
      title: this.collection.facetDisplayName
    }));
    this.collection.map(function(facetItem) {
      var facetItemView = new FacetItemView({
        facetItemTemplateFunction: _this.options.facetItemTemplateFunction,
        model: facetItem
      });
      facetItemView.render();
      _this.$el.append(facetItemView.el);
    });
  }
});
var FacetsView = Backbone.View.extend({
  initialize: function(options) {
    this.facetTemplateFunction = _.template(options.facetTemplate);
    this.facetItemTemplateFunction = _.template(options.facetItemTemplate);
  },
  render: function() {
    var _this = this;
    resultHTML = "";
    this.options.facets.map(function(facet) {
      var facetView = new FacetView({
        facetTemplateFunction: _this.facetTemplateFunction,
        facetItemTemplateFunction: _this.facetItemTemplateFunction,
        id: facet.facetName,
        collection: facet
      });
      facetView.render();
      _this.$el.append(facetView.el);
    });
  },
});
