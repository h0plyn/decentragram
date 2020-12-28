import React, { Component } from 'react';
import Web3 from 'web3';
import Identicon from 'identicon.js';
import './App.css';
import Decentragram from '../abis/Decentragram.json';
import Navbar from './Navbar';
import Main from './Main';

// Connect to IPFS
const ipfsClient = require('ipfs-http-client');
const ipfs = ipfsClient({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
});

// Web3 is the main JS library for interacting with Ethereum
// Turns our clientside app into a blockchain app
// Metamask turns our browser into a blockchain browser

class App extends Component {
  async componentWillMount() {
    await this.loadWeb3();
    await this.loadBlockchainData();
  }

  // Boilerplate code. Checks to see if browser has access to Ethereum.
  async loadWeb3() {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      await window.ethereum.enable();
    } else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
    } else {
      window.alert(
        'Non-Ethereum browser detected. You should consider trying Metamask!'
      );
    }
  }

  async loadBlockchainData() {
    const web3 = window.web3;

    // Fetch account from Metamask
    const accounts = await web3.eth.getAccounts();
    // Set the current account from MetaMask on state
    this.setState({ account: accounts[0] });

    // Get Network ID (Ganache in this case @ 5777)
    const networkId = await web3.eth.net.getId();
    const networkData = Decentragram.networks[networkId];

    if (networkData) {
      // Create a JS version of the contract with web3
      // Allows us to call the functions inside the contract
      const decentragram = web3.eth.Contract(
        Decentragram.abi,
        networkData.address
      );
      this.setState({ decentragram });
      // We need to use .call() because we are using web3js to access the blockchain
      const imagesCount = await decentragram.methods.imageCount().call();
      this.setState({ imagesCount });

      // Load Images from Blockchain
      for (let i = 1; i <= imagesCount; i++) {
        const image = await decentragram.methods.images(i).call();
        this.setState({ images: [...this.state.images, image] });
      }

      // Sort images, shows highest tipped images first
      this.setState({
        images: this.state.images.sort((a, b) => b.tipAmount - a.tipAmount),
      });

      this.setState({ loading: false });
    } else {
      window.alert('Decentragram contract not deployed to detected network.');
    }
  }

  captureFile = event => {
    event.preventDefault();

    // Pre-process the file so it can be uploaded to IPFS
    // Read file off target
    const file = event.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(file);

    reader.onloadend = () => {
      this.setState({ buffer: Buffer(reader.result) });
      console.log('buffer', this.state.buffer);
    };
  };

  uploadImage = description => {
    console.log('Submitting file to IPFS....');

    // Adding file to the IPFS
    ipfs.add(this.state.buffer, (error, result) => {
      console.log('IPFS result', result);
      if (error) {
        console.error(error);
        return;
      }

      this.setState({ loading: true });
      // Calling the smart contract function to load it to the blockchain
      this.state.decentragram.methods
        .uploadImage(result[0].hash, description)
        .send({ from: this.state.account })
        .on('transactionHash', hash => {
          this.setState({ loading: false });
        });
    });
  };

  tipImageOwner = (id, tipAmount) => {
    this.setState({ loading: true });
    this.state.decentragram.methods
      .tipImageOwner(id)
      .send({ from: this.state.account, value: tipAmount })
      .on('transactionHash', hash => {
        this.setState({ loading: false });
      });
  };

  constructor(props) {
    super(props);
    this.state = {
      account: '',
      decentragram: null,
      images: [],
      loading: true,
    };
  }

  render() {
    return (
      <div>
        <Navbar account={this.state.account} />
        {this.state.loading ? (
          <div id="loader" className="text-center mt-5">
            <p>Loading...</p>
          </div>
        ) : (
          <Main
            captureFile={this.captureFile}
            uploadImage={this.uploadImage}
            images={this.state.images}
            tipImageOwner={this.tipImageOwner}
          />
        )}
        }
      </div>
    );
  }
}

export default App;
