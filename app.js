var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var client_id = '4ee1d53243074fdc8e16cf4f989e356c'; // Your client id
var client_secret = '0f0043cf1a6645788e7167f9ca142fde'; // Your secret
var redirect_uri = 'https://lit-cove-69879.herokuapp.com/callback'; // Your redirect uri

var access_token=null;
var refresh_token=null;

var firebase = require("firebase");

firebase.initializeApp({
  serviceAccount: "spotify-queue-14ce4a820e44.json",
  databaseURL: "https://spotify-queue.firebaseio.com/"
});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(bodyParser())
   .use(cookieParser());
app.set('view engine', 'jade');

app.get('/', function(req, res){
	res.render('index', {pageData: {error: req.query.error}});
});

app.get('/login', function(req, res) {
  console.log('logging in');
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'playlist-modify-private playlist-modify-public user-read-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
  res.send('true');
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter
  console.log("callback");
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    console.log('error wrong state')
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
    	console.log(error);
    	console.log(body);
        access_token = body.access_token;
        refresh_token = body.refresh_token;
        // res.render('createPlaylist', {pageData: {access_token : access_token, refresh_token: refresh_token, error: error}});   
    	res.redirect('createPlaylist?access_token='+access_token+'&refresh_token='+refresh_token+'&error='+error);
    });
  }
});

app.get('/createPlaylist', function(req,res){
  res.render('createPlaylist', {pageData: {access_token : req.query.access_token, refresh_token: req.query.refresh_token, error: req.query.error}});   

}); 
app.get('/confirmPlaylist', function(req,res){
    res.render('confirmPlaylist', {pageData: {pin: req.query.pin, playlist_name:req.query.playlist_name}});   
}); 
app.get('/playlist', function(req,res){
     res.render('playlist', {pageData: {user_name: req.query.user_name, playlist_name: req.query.playlist_name,pin:req.query.pin, refresh_token:req.query.refresh_token}});   
}); 
app.post('/findPlaylist', function(req, res){
	var db = firebase.database();
	var playlists = db.ref("playlists");
	playlists.once("value", function(snapshot) {
  		if(snapshot.val()[req.body.pin]){
  			console.log('pinn: '+req.body.pin);
  			var playlistName= snapshot.val()[req.body.pin].playlist_name;
  			var userName= snapshot.val()[req.body.pin].user_name;
  			var refresh_token = snapshot.val()[req.body.pin].refresh_token;
  			res.redirect('playlist?playlist_name='+playlistName+'&user_name='+userName+'&pin='+req.body.pin+'&refresh_token='+refresh_token);
  		}

  		else{
  			res.redirect('/?error=notfound');
  		}

		}, function (errorObject) {
		  		console.log("The read failed: " + errorObject.code);
		});
});
//c
app.post('/findSongs', function(req, res){
	var querystring = 'track:' + req.body.track.replace(/\s/g, '+');
  	if(req.body.artist)
  		querystring+='+artist:' + req.body.artist.replace(/\s/g, '+');
  	querystring+='&type=track';

	var options = {
		url: 'https://api.spotify.com/v1/search/?q=' + querystring
	};
	request.post(options, function(error, response, body) {
		if(error){
          	console.log("error finding tracks");
         }
         else{
         	console.log(response);
         	console.log("boasdfasdfasdfasdfasfasdf");
         	console.log(body);
         }
	});
});
app.use('/addSongToPlaylist', function(req, res, next) {
  var refresh_token = req.body.refresh_token;
  console.log(refresh_token);
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      //update accesstoken
      var db = firebase.database();
	  var playlists = db.ref("playlists");
	  var playlist = playlists.child(req.body.pin);
		playlist.update({
		  	'access_token':access_token
		});
		next();
    }
  });
});

app.post('/addSongToPlaylist', function(req, res){
	var songID = req.body.songID;
	var pin = req.body.pin;
	console.log('pin'+pin);
	var db = firebase.database();
	var playlists = db.ref("playlists");
	playlists.once("value", function(snapshot) {
  		var playlist_id = snapshot.val()[pin].playlist_id;
  		var user_id = snapshot.val()[pin].user_id;
  		var token = snapshot.val()[pin].access_token;

  		var options = {
			url: 'https://api.spotify.com/v1/users/' + user_id +'/playlists/'+playlist_id+'/tracks',
			headers: { 'Authorization': 'Bearer ' + token },
			json: true,
			body: {"uris": [songID]}
		};
		request.post(options, function(error, response, body) {
			console.log('error: ' +error);
			console.log('response: ' +JSON.stringify(body));
			if(body.snapshot_id){
				res.send(200);
			}
			else{
				res.send(400);
			}
		});


}, function (errorObject) {
  		console.log("The read failed: " + errorObject.code);
});	

});

app.post('/createPlaylist', function(req, res) {
	var post_data = querystring.stringify({
      name: req.body.playlistName,
  	});

	var options = {
		url: 'https://api.spotify.com/v1/users/' + req.body.user_id +'/playlists',
		headers: { 'Authorization': 'Bearer ' + req.body.access_token },
		json: true,
		body: {name: req.body.playlistName}
	};

	request.post(options, function(error, response, body) {
          if(error){
          	console.log("spotify error creating playlist");
          }
          else{
          	var db = firebase.database();
			var playlists = db.ref("playlists");
			getUniquePin(function(pin,id){
				

				playlist = {};
				var db_body = {playlist_name: req.body.playlistName,
						playlist_id: id,
					    user_id: req.body.user_id,
					    user_name: req.body.user_name,
					    access_token: req.body.access_token,
					    refresh_token: refresh_token};
				console.log('body ' +pin);
				playlist[pin] = db_body;
				playlists.update(
				  	playlist
				);
				console.log(req.body.playlistName);
			    res.send({pageData:{pin:pin,playlist_name:req.body.playlistName}});

			},body.id);		
          }
    });	
});



var generateUniqueCombination = function(){
    var result = '';
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = 4; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

var getUniquePin = function(callback,id){
	var db = firebase.database();
	var playlists = db.ref("playlists");
	playlists.once("value", function(snapshot) {
  		// console.log(snapshot.val());
  		var combo = generateUniqueCombination();

  		while(snapshot.val()!=null && snapshot.val()[combo]){
  			combo = generateUniqueCombination();
  		}
  		console.log("combo" + combo);
  		callback(combo,id);

}, function (errorObject) {
  		console.log("The read failed: " + errorObject.code);
});
};

app.set('port', (process.env.PORT || 80));
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});