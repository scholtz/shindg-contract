import { Contract } from '@algorandfoundation/tealscript';

type Token = {
  /**
   * Owner can move NFT to another account or he can delegate moving to this NFT or he can delegate moving rights to all NFTs under this contract
   */
  owner: Address;
  /**
   * Delegated account address who can transfer the NFT
   */
  controller: Address;
  /**
   * State of the ticket
   *
   * ON_SALE | NOT_CHECKED_IN | CHECKED_IN | CHECKED_OUT
   */
  state: string;
  /**
   * Area of the seat. If event allows to pick seats only just before the checkin time user can upgrade his ticket only within the same area.
   */
  area: string;
  /**
   * The exact location where person will seat
   */
  seat: string;
  /**
   * URL address of the NFT
   */
  uri: string;
  /**
   * Image URL
   */
  image: string;
};
type Control = {
  /**
   * Anyone can create control box. If he owns or will own NFT this delegation control allows the other account to transfer any of the owners NFTs to third party
   */
  owner: Address;
  /**
   * Address to whom is the transfer delegated
   */
  controller: Address;
};

export class Shindg extends Contract {
  index = GlobalStateKey<uint256>();

  /**
   * NFT Name - Event name
   */
  name = GlobalStateKey<string>();

  /**
   * NFT Symbol
   */
  symbol = GlobalStateKey<string>();

  /**
   * List of NFTs under this smart contract
   */
  tokenBox = BoxMap<uint256, Token>();

  /**
   * Owner Account can delegate the permission to move any NFT in this contract to another address. In this box is information about the delegation.
   */
  controlBox = BoxMap<Control, bytes>();

  /**
   * Constructor
   * @param name NFT Name
   * @param symbol NFT Symbol
   */
  createApplication(name: string, symbol: string): void {
    this.name.value = name;
    this.symbol.value = symbol;
  }

  // PRIVATE METHODS

  /**
   * Execute transfer - change the state of the token.
   * @param to Address of receiver
   * @param tokenId TokenID
   */
  private transferTo(to: Address, tokenId: uint256): void {
    assert(this.tokenBox(tokenId).exists);
    this.tokenBox(tokenId).value.owner = to;
    this.tokenBox(tokenId).value.controller = globals.zeroAddress;
  }

  // ARC76 NON READONLY METHODS

  /**
   * Transfers ownership of an NFT
   */
  arc72_transferFrom(_from: Address, to: Address, tokenId: uint256): void {
    const token = this.tokenBox(tokenId).value;

    const key: Control = { owner: this.txn.sender, controller: _from };

    if (this.txn.sender === _from || this.txn.sender === token.controller || this.controlBox(key).exists) {
      this.transferTo(to, tokenId);
    } else throw Error('Transfer not authorized');
  }

  /**
   *
   * Approve a controller for a single NFT
   *
   * @param approved Approved controller address
   * @param tokenId The ID of the NFT
   */
  arc72_approve(approved: Address, tokenId: uint256): void {
    assert(this.tokenBox(tokenId).exists);
    assert(this.txn.sender === this.tokenBox(tokenId).value.owner);

    this.tokenBox(tokenId).value.controller = approved;
  }

  /**
   *
   * Approve an operator for all NFTs for a user
   *
   * @param operator Approved operator address
   * @param approved true to give approval, false to revoke
   * @returns
   */
  arc72_setApprovalForAll(operator: Address, approved: boolean): void {
    const key: Control = { owner: this.txn.sender, controller: operator };

    if (approved) this.controlBox(key).value = '';
    else if (this.controlBox(key).exists) this.controlBox(key).delete();
  }

  // ARC76 READONLY METHODS

  /**
   *
   * Returns the address of the current owner of the NFT with the given tokenId
   *
   * @param tokenId The ID of the NFT
   * @returns The current owner of the NFT
   */
  @abi.readonly
  arc72_ownerOf(tokenId: uint256): Address {
    return this.tokenBox(tokenId).value.owner;
  }

  /**
   *
   * Returns a URI pointing to the NFT metadata
   *
   * @param tokenId The ID of the NFT
   * @returns URI to token metadata
   */
  @abi.readonly
  arc72_tokenURI(tokenId: uint256): string {
    return this.tokenBox(tokenId).value.uri;
  }

  /**
   * Returns the number of NFTs currently defined by this contract
   */
  @abi.readonly
  arc72_totalSupply(): uint256 {
    return this.index.value;
  }

  /**
   * Returns the token ID of the token with the given index among all NFTs defined by the contract
   */
  @abi.readonly
  arc72_tokenByIndex(index: uint256): uint256 {
    return index;
  }

  // OTHER NFT METHODS
  mint(to: Address, area: string, seat: string, image: string, uri: string): void {
    assert(
      this.txn.sender === globals.creatorAddress,
      'Only creator is allowed to mint specific NFTs for this collection'
    );

    const index = this.index.value;

    const token: Token = {
      owner: to,
      controller: Address.zeroAddress,
      state: 'ON_SALE',
      area: area,
      seat: seat,
      uri: uri,
      image: image,
    };

    this.tokenBox(index).value = token;
    this.transferTo(to, index);
    this.index.value = index + 1;
  }
}
