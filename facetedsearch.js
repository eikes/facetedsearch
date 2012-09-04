// Models
var Item = Backbone.Model.extend({
  defaults: function() {
    return {
      "__visible__": true
    };
  },
  applyFilters: function(filters) {
    // todo; compare filters with this and set this.visible accordingly
    console.log(this, arguments);
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
      "itemCount" : 0,
      "name"      : ""
    };
  },
  toggle: function() {
    this.set("active", !this.get("active"));
  }
});
var Facet = Backbone.Collection.extend({
  model: FacetItem,
  getActive: function() {
    var active = this.filter(function(facetItem){ 
      return facetItem.get('active'); 
    });
    active = active.map(function(facetItem){
      return facetItem.get("name");
    });
    return active;
  }
});
var FacetedSearch = Backbone.Model.extend({
  update: function(){
    var filters = {};
    _.each(this.get("facetsList"), function(facet){
      filters[facet.facetName] = facet.getActive();
    });
    var visible;
    this.get("items").each(function(item){
      visible = true;
      _.each(filters, function(filterValues, filter) {
        if (filterValues.length && _.intersection(filterValues, _.flatten([item.get(filter)])).length == 0) {
          visible = false;
        }
      });
      if (item.get("__visible__") != visible) {
        // This is silent, so the list is not repainted over and over again
        item.set({"__visible__": visible}, {silent: true});
      }
    });
    // Paint it once:
    this.get("items").trigger("change:__visible__");
  },
  initialize: function(options) {
    // Find all items and convert them into Models in a Collection
    var items = new ItemList(_.map(options.items, function(item) { 
      return new Item(item);
    }));
    this.set("items", items);
    // Find all Facets and FacetItems
    var _this = this;
    var facetsList = _.map(options.facets, function(facetDisplayName, facetName) {
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
    this.set("facetsList", facetsList);
  }
});

// Views
var ItemsView = Backbone.View.extend({
  initialize: function(options) {
    var _this = this;
    this.itemTemplate = _.template(options.itemTemplate);
    this.collection.bind("change:__visible__", function() {
      _this.render();
    });
  },
  render: function() {
    var _this = this;
    var visibleItems = this.collection.getVisible();
    resultHTML = "";
    visibleItems.map(function(item) {
      resultHTML += _this.itemTemplate(item.attributes);
    });
    this.$el.html(resultHTML);
  },
});
var FacetItemView = Backbone.View.extend({
  initialize: function(){
    var _this = this;
    this.model.bind("change:active", function() {
      _this.$el.toggleClass("activefacet");
    });
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
      count: this.model.get("itemCount"),
    }));
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
