const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rhmnp.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  console.log(token);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const toolsCollection = client.db('Tools').collection('tools');
    const purchaseCollection = client.db('Purchase').collection('purchase');
    const paymentCollection = client.db('Purchase').collection('payment');
    const myprofileCollection = client.db('Tools').collection('myprofile');
    const userCollection = client.db('Tools').collection('user');
    const reviewsCollection = client.db('Tools').collection('reviews');

    console.log('Database connected successfully');

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === 'admin') {
        next();
      } else {
        res.status(403).send({ message: 'forbidden' });
      }
    };

    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '1d' },
      );
      res.send({ result, token });
    });

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    });

    app.get('/tools', async (req, res) => {
      const query = {};
      const cursor = toolsCollection.find(query);
      const tools = await cursor.toArray();

      res.send(tools);
    });

    app.post('/tools', verifyJWT, verifyAdmin, async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await toolsCollection.insertOne(data);
      console.log(result);
      res.send(result);
    });
    app.delete('/tools/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await toolsCollection.deleteOne(query);
      res.send(result);
    });

    app.get('/tools/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const tool = await toolsCollection.findOne(query);
      res.send(tool);
    });

    app.put('/tools/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const quantity = req.query.minimumquanyity;
      const email = req.query.email;
      const price = req.query.price;
      const query = { _id: ObjectId(id) };

      const tool = await toolsCollection.findOne(query);

      const updateDoc = {
        $set: {
          availableQuantity: tool.availableQuantity - quantity,
        },
      };
      const tool1 = await toolsCollection.updateOne(query, updateDoc);
      const tool2 = await toolsCollection.findOne(query);
      console.log('tools2', tool2);

      res.send(tool2);
    });

    app.get('/reviews', async (req, res) => {
      const query = {};
      const cursor = reviewsCollection.find(query);
      const reviews = await cursor.toArray();

      res.send(reviews);
    });

    app.post('/reviews', verifyJWT, async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await reviewsCollection.insertOne(data);
      console.log(result);
      res.send(result);
    });

    app.get('/purchaseall', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const cursor = purchaseCollection.find(query);
      const purchase = await cursor.toArray();

      res.send(purchase);
    });
    app.patch('/purchaseall/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);

      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'shipped',
        },
      };

      const updatedPurchse = await purchaseCollection.updateOne(
        filter,
        updatedDoc,
      );
      res.send(updatedPurchse);
    });

    app.put('/purchase/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const price = req.query.price;
      const quantity = req.query.quantity;
      const email = req.query.email;

      const query = { _id: ObjectId(id) };

      const tool = await toolsCollection.findOne(query);
      tool.totalPrice = price * quantity;
      const options = { upsert: true };
      const updateDoc = {
        price: tool.price,
        email: email,
        totalPrice: price * quantity,

        totalOrder: quantity,
        name: tool.name,
        description: tool.description,
      };

      console.log('hello', tool);
      const result = await purchaseCollection.insertOne(updateDoc);
      const ress = await purchaseCollection.findOne(query);
      console.log('helloooo', ress);
      res.send(result);
    });

    app.delete('/purchase/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await purchaseCollection.deleteOne(query);
      res.send(result);
    });

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const service = req.body;
      const totalPrice = service.totalPrice;
      const amount = totalPrice * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    app.get('/purchase', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email: email };
      const orders = await purchaseCollection.find(query).toArray();
      console.log(orders);
      res.send(orders);
    });
    app.get('/purchase/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await purchaseCollection.findOne(query);
      res.send(booking);
    });

    app.patch('/purchase/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const payment = req.body;
      console.log(payment);
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment);
      console.log(result);
      const updatedBooking = await purchaseCollection.updateOne(
        filter,
        updatedDoc,
      );
      res.send(updatedBooking);
    });

    app.post('/myprofile', async (req, res) => {
      const data = req.body;
      const result = await myprofileCollection.insertOne(data);
      res.send(result);
    });
    app.patch('/myprofile', async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email: email };
      console.log(req.body);
      const { updatename, updateeducation, updatelocation, updatephone } =
        req.body;
      const updateDoc = {
        $set: {
          name: updatename,
          email: email,
          education: updateeducation,
          location: updatelocation,
          phone: updatephone,
        },
      };
      const result1 = await myprofileCollection.findOne(query);
      const id = result1._id.toString().replace('new ', '');
      const filter = { _id: ObjectId(id) };

      const result = await myprofileCollection.updateOne(filter, updateDoc);
      console.log('Reseult1:', id);
      res.send(result1);
    });

    app.get('/myprofile', async (req, res) => {
      const users = await myprofileCollection.find().toArray();
      res.send(users);
    });
  } finally {
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello!');
});

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
