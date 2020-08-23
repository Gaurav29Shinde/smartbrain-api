const express = require('express');
const cors = require('cors');
const app = express();
const bcrypt = require('bcrypt-nodejs');
var knex = require('knex');
const Clarifai = require('clarifai');

const app1 = new Clarifai.App({
 apiKey: '' //Enter your own API key here!
});

const handleApiCall = (req,res) => {
	app1.models.predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
	.then(data => {
		res.json(data);
	})
	.catch(err => res.status(400).json("Unable to work with api"))
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const db = knex({
			  client: 'pg',
			  connection: {
			    connectionString : process.env.DATABASE_URL,
			    ssl : true
  			  }
		   });


app.use(express.json());
app.use(cors());

app.post('/imageUrl',(req,res) => {handleApiCall(req,res)})

app.get('/',(req,res) => {
	res.send('It is working');
})

app.post('/signin',(req,res) => {
	const { email, password } = req.body;
	if( !email || !password ){
		return res.status(400).json("Incorrect form submission")
	}
	db.select('email','hash').from('login')
	.where('email', '=', email)
	.then(data => {
		const isValid = bcrypt.compareSync(password, data[0].hash);
		if(isValid){
			return db.select('*').from('users')
			.where('email', '=', email)
			.then(user => {
				res.json(user[0])
			})
			.catch(err => res.status(400).json("Unable to get user"))
		}else{
			res.status(400).json("Wrong Credentials")
		}
	})
	.catch(err => res.status(400).json("Wrong Credentials"))
})

app.post('/register',(req,res) => {
	const { email, password, name } = req.body;
	if( !email || !name || !password ){
		return res.status(400).json("Incorrect form submission")
	}
	const hash = bcrypt.hashSync(password);
	db.transaction(trx => {
		trx.insert({
			hash : hash,
			email : email
		})
		.into('login')
		.returning('email')
		.then(loginEmail => {
			return db('users')
					.returning('*')
					.insert({
						email : loginEmail[0],
						name : name,
						joined : new Date()
					})
					.then(user => {
						res.json(user[0]);
					})
		})
		.then(trx.commit)
		.catch(trx.rollback)
	})
	
	.catch(err => res.status(400).json("Unable to register"));
})

app.get('/profile/:id',(req,res) => {
	const { id } = req.params;

	db.select('*').from('users').where({id})	//where({id : id}) is the old syntax, where({id}) is ES6
	  .then(user => {
	  	if(user.length){
			res.json(user[0])
		}
		else{
			res.status(400).json("Not found")
		}	  	
	  })
	  .catch(err => res.status(400).json("Error getting user"))
})

app.put('/image',(req,res) => {
	const { id } = req.body;
	db('users').where('id', '=', id)
	.increment('entries', 1)
	.returning('entries')
	.then(entries => {
		res.json(entries[0]);
	})
	.catch(err => res.status(400).json("Unable to get entries"))
})

app.listen(process.env.PORT || 3000,() => {
	console.log(`App is running on port ${process.env.PORT}`);
})