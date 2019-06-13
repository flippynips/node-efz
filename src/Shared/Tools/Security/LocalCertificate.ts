import * as forge from 'node-forge';

/** Repsents a complete local certificate with public and private keys. */
export class LocalCertificate {
  
  //---------------------------------------------//
  
  /** Certificate. */
  public readonly Certificate: forge.pki.Certificate;
  /** Key pair used to generate the certificate. */
  public readonly Pair: forge.pki.rsa.KeyPair;
  
  /** Get a pem string representation of the certificate. */
  public get CertificateStr(): string {
    return forge.pki.certificateToPem(this.Certificate);
  }
  
  /** Get a pem string representation of the public key. */
  public get PublicKeyStr(): string {
    return forge.pki.publicKeyToPem(this.Pair.publicKey);
  }
  
  //---------------------------------------------//
  
  //---------------------------------------------//
  
  constructor(certificate: forge.pki.Certificate, pair: forge.pki.rsa.KeyPair) {
    this.Certificate = certificate;
    this.Pair = pair;
  }
  
  /** Create a new local certificate and key pair. */
  public static async Create(): Promise<LocalCertificate> {
    
    const commonName: string = 'com.pram.me';
    const countryName: string = 'AU';
    const stateName: string = 'IV';
    const localityName: string = 'Rev';
    const organizationName: string = 'pram';
    const organizationUnit: string = 'driver/rider';
    
    // generate a keypair and create an X.509v3 certificate
    var keys = await new Promise<forge.pki.rsa.KeyPair>(
      (resolve, reject) => {
        forge.pki.rsa.generateKeyPair(2048, null,
          (err: Error, keypair: forge.pki.rsa.KeyPair) => {
            if(err) reject(err);
            resolve(keypair);
          }
        );
      }
    );
    
    var cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    
    let date: Date = new Date();
    let random: number = 1 + Math.random() * 2;
    
    // NOTE: serialNumber is the hex encoded value of an ASN.1 INTEGER.
    // Conforming CAs should ensure serialNumber is:
    // - no more than 20 octets
    // - non-negative (prefix a '00' if your value starts with a '1' bit)
    cert.serialNumber = '01';
    cert.validity.notBefore = date;
    cert.validity.notAfter = new Date(date.getTime() + 1000 * 60 * 60 * random);
    
    let attrs = [{
      name: 'commonName',
      type: 'string',
      value: commonName
    }, {
      name: 'countryName',
      type: 'string',
      value: countryName
    }, {
      name: 'stateName',
      type: 'string',
      value: stateName
    }, {
      name: 'localityName',
      type: 'string',
      value: localityName
    }, {
      name: 'organizationName',
      type: 'string',
      value: organizationName
    }, {
      name: 'organizationalUnit',
      type: 'string',
      value: organizationUnit
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    cert.setExtensions([{
      name: 'basicConstraints',
      cA: true
    }, {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    }, {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true
    }, {
      name: 'nsCertType',
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true
    }, {
      name: 'subjectAltName',
      altNames: [{
        type: 6, // URI
        value: 'http://pram.org/webid#me'
      }, {
        type: 7, // IP
        ip: '127.0.0.1'
      }]
    }, {
      name: 'subjectKeyIdentifier'
    }]);
    
    // self-sign certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    // return the key pair
    return new LocalCertificate(cert, keys);
    
  }
  
  //---------------------------------------------//
  
}

