pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./DataStore.sol";

library UserWallet {
    using SafeMath for uint256;

    // Event for balance updates
    event BalanceUpdate(address token, address user, uint256 balance, uint256 escrow);

    string constant WALLET_PREFIX = "wallets/";
    string constant BALANCE_KEY = "/balance";
    string constant ESCROW_KEY = "/escrow_balance";

    function balanceOf(address dataStoreContract, address token, address user) internal view returns (uint256) {
        bytes32 h = keccak256(abi.encodePacked(WALLET_PREFIX, token, user, BALANCE_KEY));
        DataStore ds = DataStore(dataStoreContract);

        return ds.getUIntValue(h);
    }

    function addToBalance(address dataStoreContract, address token, address user, uint256 amount) internal {
        bytes32 h = keccak256(abi.encodePacked(WALLET_PREFIX, token, user, BALANCE_KEY));
        DataStore ds = DataStore(dataStoreContract);

        ds.setUIntValue(h, ds.getUIntValue(h).add(amount));
    }

    function subFromBalance(address dataStoreContract, address token, address user, uint256 amount) internal {
        bytes32 h = keccak256(abi.encodePacked(WALLET_PREFIX, token, user, BALANCE_KEY));
        DataStore ds = DataStore(dataStoreContract);
        uint balance = ds.getUIntValue(h);

        require(balance >= amount, "ERR_INSUFFICIENT_BALANCE");

        ds.setUIntValue(h, balance.sub(amount));
    }

    function escrowBalanceOf(address dataStoreContract, address token, address user) internal view returns (uint256) {
        bytes32 h = keccak256(abi.encodePacked(WALLET_PREFIX, token, user, ESCROW_KEY));
        DataStore ds = DataStore(dataStoreContract);

        return ds.getUIntValue(h);
    }

    function moveToEscrow(address dataStoreContract, address token, address user, uint256 amount) internal {
        bytes32 balanceHash = keccak256(abi.encodePacked(WALLET_PREFIX, token, user, BALANCE_KEY));
        bytes32 escrowHash = keccak256(abi.encodePacked(WALLET_PREFIX, token, user, ESCROW_KEY));
        DataStore ds = DataStore(dataStoreContract);

        uint balance = ds.getUIntValue(balanceHash);

        require(balance >= amount, "ERR_INSUFFICIENT_BALANCE");

        ds.setUIntValue(balanceHash, balance.sub(amount));
        ds.setUIntValue(escrowHash, ds.getUIntValue(escrowHash).add(amount));
    }

    function recoverFromEscrow(address dataStoreContract, address token, address user, uint256 amount) internal {
        releaseEscrow(dataStoreContract, token, user, user, amount);
    }

    function releaseEscrow(address dataStoreContract, address token, address fromAddress, address toAddress, uint256 amount) internal {
        bytes32 balanceHash = keccak256(abi.encodePacked(WALLET_PREFIX, token, toAddress, BALANCE_KEY));
        bytes32 escrowHash = keccak256(abi.encodePacked(WALLET_PREFIX, token, fromAddress, ESCROW_KEY));
        DataStore ds = DataStore(dataStoreContract);

        uint escrowBalance = ds.getUIntValue(escrowHash);

        require(escrowBalance >= amount, "ERR_INSUFFICIENT_BALANCE");

        ds.setUIntValue(escrowHash, escrowBalance.sub(amount));
        ds.setUIntValue(balanceHash, ds.getUIntValue(balanceHash).add(amount));
    }

    function notifyBalanceUpdate(address dataStoreContract, address token, address user) internal {
        emit BalanceUpdate(token, user, balanceOf(dataStoreContract, token, user), escrowBalanceOf(dataStoreContract, token, user));
    }
}