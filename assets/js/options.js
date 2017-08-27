/**
 * Options module to manage the options
 * @returns {{init: init}}
 * @constructor
 */
function HubOptions() {
  var hubStorage = new HubStorage();

  /**
   * Performs the UI bindings
   */
  function bindUI() {
    $(document).on("click", ".save-token", function(e) {
      e.preventDefault();

      hubStorage.persistFilters(".githunt_token");
      $(".quote-item").html("Woohoo! Token saved, happy hunting.");
    });

    $(document).on("change", "#per-page", function() {
      hubStorage.persistFilters("#per-page");
    });

    $("#per-page").multiselect();
  }

  return {
    /**
     * Initializes the options page
     */
    init: function() {
      var tokenPopulated = hubStorage.populateFilters(".githunt_token");
      if (tokenPopulated) {
        $(".quote-item").html("Token already saved. Better go for the hunt!");
      }

      hubStorage.populateFilters("#per-page");
      bindUI();
    }
  };
}

$(function() {
  var hubOptions = new HubOptions();
  hubOptions.init();
});
