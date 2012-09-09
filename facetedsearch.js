// Models
var Item = Backbone.Model.extend({
  defaults: function() {
    return {
      "__active__": true,
      "__visible__": false
    };
  }
});
var ItemList = Backbone.Collection.extend({
  model: Item,
  getActive: function(){
    return this.filter(function(item){
      return item.get("__active__");
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
    this.updateActiveItems.call(this);
    this.updateVisibleItems.call(this);
    this.updateFacetCount.call(this);
  },
  // applies the filters as they are set in the facets
  // to the items and sets the __active__ property accordingly
  updateActiveItems: function() {
    var _this = this;
    var active, facetApplies, facetValue, facetName, itemValue;
    this.get("items").each(function(item) {
      active = true;
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
          active = false;
        }
      });
      item.set({"__active__": active});
    });
    this.set("activeCount", this.get("items").getActive().length);
  },
  // not all items which are active will be shown, show only the first X
  updateVisibleItems: function() {
    var visibleCount = 0, 
        _this = this;
    this.get("items").each(function(item){
      if (item.get("__active__") && visibleCount < _this.get("maxVisibleCount")) {
        item.set({"__visible__": true});
        visibleCount += 1;
      } else {
        item.set({"__visible__": false});
      }
    });
    this.set("visibleCount", visibleCount);
  },
  // updates the count property of the facet items
  updateFacetCount: function() {
    var _this = this;
    var facetActive, facetValue, facetName, itemValue;
    _.each(_this.get("facets"), function(facet){
      facet.each(function(facetItem){
        facetItem.set({count: 0}, {silent: true});
      });
    });
    this.get("items").each(function(item){
      if (item.get("__active__")) {
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
    items.facetedSearch = this;
    this.set("maxVisibleCount", options.paginationCount);
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
    facets.facetedSearch = this;
    this.update();
  }
});

// Views
var ItemView = Backbone.View.extend({
  initialize: function() {
    this.model.on("change:__visible__", this.updateVisible, this);
  },
  updateVisible: function() {
    if (this.model.get("__visible__")) {
      this.el.style.display = "";
    } else {
      this.el.style.display = "none";
    }
  },
  className: "item",
  render: function() {
    var html = this.model.collection.itemTemplate(this.model.attributes);
    this.el.innerHTML = html;
    this.updateVisible();
  }
});
var ItemsView = Backbone.View.extend({
  initialize: function(options) {
    this.collection.itemTemplate = _.template(options.itemTemplate);
    fs.on("change:activeCount", this.updateButtonVisibility, this);
    fs.on("change:visibleCount", this.updateButtonVisibility, this);
  },
  updateButtonVisibility: function(){
    var fs = this.collection.facetedSearch;
    var button = this.el.getElementsByTagName("button")[0];
    if (fs.get("visibleCount") >= fs.get("activeCount") || fs.get("visibleCount") > fs.get("maxVisibleCount")) {
      button.style.display = "none";
    } else {
      button.style.display = "";
    }
  },
  events: {
    "click button": function(){
      var fs = this.collection.facetedSearch;
      fs.set("maxVisibleCount", fs.get("maxVisibleCount") + fs.get("paginationCount"));
      fs.updateVisibleItems();
    }
  },
  render: function() {
    var itemView;
    this.el.innerHTML = this.options.itemsTemplate;
    var div = this.el.getElementsByTagName("div")[0];
    this.collection.map(function(item, position) {
      itemView = new ItemView({
        model: item
      });
      itemView.render();
      div.appendChild(itemView.el);
    });
    this.updateButtonVisibility.call(this);
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
      if (!this.el.className.match("activefacet")) {
        this.el.className = this.el.className += " activefacet";
      }
    } else {
      this.el.className = _.without(this.el.className.split(" "), "activefacet").join(" ");
    }
  },
  className: "facetitem",
  events: {
    "click": function(){
      this.model.toggle();
    }
  },
  render: function() {
    this.el.innerHTML = this.options.facetItemTemplateFunction({
      name: this.model.get("name"),
      count: this.model.get("count"),
    });
    this.updateActive();
  }
});
var FacetView = Backbone.View.extend({
  className: "facet",
  render: function() {
    var _this = this;
    this.el.innerHTML = this.options.facetTemplateFunction({
      title: this.collection.facetDisplayName
    });
    this.collection.map(function(facetItem) {
      var facetItemView = new FacetItemView({
        facetItemTemplateFunction: _this.options.facetItemTemplateFunction,
        model: facetItem
      });
      facetItemView.render();
      _this.el.appendChild(facetItemView.el);
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
      _this.el.appendChild(facetView.el);
    });
  },
});
