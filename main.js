'use strict';

if (1 === 2) {
  var gaJsHost = (("https:" == document.location.protocol) ? "https://ssl." : "http://www.");
  document.write(unescape("%3Cscript src='" + gaJsHost + "google-analytics.com/ga.js' type='text/javascript'%3E%3C/script%3E"));

  try {
    var pageTracker = _gat._getTracker("UA-73109746-1");
    pageTracker._trackPageview();
  } catch(err) {

  }
}

$(document).ready(function() {

  $('.feature-header .btn').click(function (e) {
    var id = $(e.currentTarget).attr('id');
    console.log(id);
    $('.feature-header .btn').removeClass('active');
    $(e.currentTarget).addClass('active');
    execScript(scripts[id] || scripts['feature1']);
  });

});