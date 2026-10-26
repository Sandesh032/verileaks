/**
 * ProofBindings.js — Canonical Semaphore scope and message bindings matching ProofBindings.sol.
 */

import { ethers } from "ethers";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

export const JUROR_SCOPE_TAG = ethers.keccak256(ethers.toUtf8Bytes("VERILEAKS_JUROR_REGISTRATION_SCOPE_V1"));
export const JUROR_MESSAGE_TAG = ethers.keccak256(ethers.toUtf8Bytes("VERILEAKS_JUROR_REGISTRATION_MESSAGE_V1"));
export const DISPUTE_SCOPE_TAG = ethers.keccak256(ethers.toUtf8Bytes("VERILEAKS_DISPUTE_OPEN_SCOPE_V1"));
export const DISPUTE_MESSAGE_TAG = ethers.keccak256(ethers.toUtf8Bytes("VERILEAKS_DISPUTE_OPEN_MESSAGE_V1"));

export function jurorRegistrationScope(chainId, selectionAddress) {
  return BigInt(ethers.keccak256(abiCoder.encode(
    ["bytes32", "uint256", "address"],
    [JUROR_SCOPE_TAG, chainId, selectionAddress]
  )));
}

export function jurorRegistrationMessage(chainId, selectionAddress, jurorAddress) {
  return BigInt(ethers.keccak256(abiCoder.encode(
    ["bytes32", "uint256", "address", "address"],
    [JUROR_MESSAGE_TAG, chainId, selectionAddress, jurorAddress]
  )));
}

export function disputeOpenScope(chainId, bountyAddress, bountyId, attempt = 0) {
  return BigInt(ethers.keccak256(abiCoder.encode(
    ["bytes32", "uint256", "address", "uint256", "uint256"],
    [DISPUTE_SCOPE_TAG, chainId, bountyAddress, bountyId, attempt]
  )));
}

export function disputeOpenMessage(chainId, bountyAddress, bountyId, attempt = 0) {
  return BigInt(ethers.keccak256(abiCoder.encode(
    ["bytes32", "uint256", "address", "uint256", "uint256"],
    [DISPUTE_MESSAGE_TAG, chainId, bountyAddress, bountyId, attempt]
  )));
}
