(function($){

  $.convertFacetToSelect = function(options){
    options = _.defaults(options || {}, {
      changeFunction : function(){ $('#' + this.value).click(); },
      multiple       : false,
      firstOption    : false,
      emptyText      : "Select Options"
    });
    var items = $(this).find('.facetitem').map(function(i, item){
      var $item = $(item);
      return {
        id: $item.attr("id"),
        text: $item.text(),
        active: $item.hasClass("activefacet")
      }
    });
    var listTemplate =   
        '<select ' + (options.multiple ? 'multiple' : '') + ' class="facetSelectBox" data-placeholder="' + options.emptyText + '">' +
        (options.firstOption || ' ') +
        '<% _.each(l, function(item) { %> ' +
        '<option value="<%= item.id %>" <% if (item.active) { %>selected <% } %>><%= item.text %></option>'+
        '<% }); %></select>';
    $html = $(_.template(listTemplate, {l : items}));
    $html.change(options.changeFunction);
    return $html;
  }
    
  $.fn.replaceFacetWithChosen = function(options) {
    return this.each(function(){
      options = _.defaults(options || {}, {
        emptyText      : "Select Options"
      });
      var $this = $(this);
      $this.find('.facetlist .facetitem').hide();
      $this.find('.facetlist').css("overflow", "visible");
      var isRmAll = false;
      var previousItems = [];
      var newSelectbox = $.convertFacetToSelect.call(this, {
        multiple: true, 
        emptyText: options.emptyText, 
        changeFunction: function(event) {
          if (!isRmAll) {
            var curItems = $this.find('option:selected');
            var newItem = _.difference(curItems, previousItems);
            previousItems = curItems;
            if (newItem.length > 0) {
              $("#"+newItem[0].value).click();
            }
          } else {
            previousItems = curItems = [];
          } 
        }
      });
      $this.find('.facetlist').append(newSelectbox);
      newSelectbox.chosen();
      // Remove chosen Chosen elements on "deselect"
      $('.deselectstartover').click(function() {
        isRmAll = true; 
        $this.find('.chzn-choices .search-choice-close').click();
        isRmAll = false;
      });
    });
  }

})(jQuery);
