module.exports = function(app){
	var express = require('express'); 
	app.use(express.static(__dirname + '/public'));

	app.get('/createPlaylist', function(req,res){
	 res.render(__dirname + '/public/createPlaylist.html');
	}); 
	app.get('/confirmPlaylist', function(req,res){
	 res.render(__dirname + '/public/confirmPlaylist.html');
	}); 
	app.get('/playlist', function(req,res){
	 res.render(__dirname + '/public/playlist.html');
	}); 

}