export const ABIS = {
  "SubmissionRegistry": [
    {
      "type": "function",
      "name": "getSubmission",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct ISubmissionRegistry.Submission",
          "components": [
            {
              "name": "submissionId",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "submitter",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "ipfsCid",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "merkleRoot",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "timestamp",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "exists",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "registerSubmission",
      "inputs": [
        {
          "name": "ipfsCid",
          "type": "string",
          "internalType": "string"
        },
        {
          "name": "merkleRoot",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "submissionCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "submissionExists",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "SubmissionRegistered",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "submitter",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "ipfsCid",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        },
        {
          "name": "merkleRoot",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "timestamp",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "EmptyIpfsCid",
      "inputs": []
    },
    {
      "type": "error",
      "name": "EmptyMerkleRoot",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SubmissionAlreadyExists",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    }
  ],
  "TokenStaking": [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "acceptOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "freeBalanceOf",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isLocker",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "lockStake",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "lockedOf",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "pendingOwner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "renounceOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setLocker",
      "inputs": [
        {
          "name": "locker",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "slashStake",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "stake",
      "inputs": [],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "totalStaked",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "newOwner",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "unlockStake",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "unstake",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "LockerUpdated",
      "inputs": [
        {
          "name": "locker",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferStarted",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "StakeLocked",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "totalLocked",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "StakeSlashed",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "StakeUnlocked",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "totalLocked",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Staked",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "newTotal",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Unstaked",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "remaining",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "InsufficientFreeStake",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "requested",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "free",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "InsufficientLockedStake",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "requested",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "locked",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "InsufficientStake",
      "inputs": [
        {
          "name": "requested",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "available",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotLocker",
      "inputs": [
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "StakeIsLocked",
      "inputs": [
        {
          "name": "requested",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "free",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "TransferFailed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroLockAmount",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroStakeAmount",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroWithdrawAmount",
      "inputs": []
    }
  ],
  "HTLC": [
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "claim",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "preimage",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "fundBounty",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "beneficiary",
          "type": "address",
          "internalType": "address payable"
        },
        {
          "name": "hashlock",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "timelock",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "getLock",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct IHTLC.Lock",
          "components": [
            {
              "name": "submissionId",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "funder",
              "type": "address",
              "internalType": "address payable"
            },
            {
              "name": "beneficiary",
              "type": "address",
              "internalType": "address payable"
            },
            {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "hashlock",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "timelock",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "status",
              "type": "uint8",
              "internalType": "enum IHTLC.Status"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "lockExists",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "refund",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "BountyClaimed",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "beneficiary",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "preimage",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BountyFunded",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "submissionId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "funder",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "beneficiary",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "hashlock",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        },
        {
          "name": "timelock",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BountyRefunded",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "funder",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AlreadyClaimed",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "AlreadyRefunded",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidPreimage",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "LockNotFound",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotBeneficiary",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotFunded",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotFunder",
      "inputs": [
        {
          "name": "lockId",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "TimelockMustBeFuture",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TimelockNotExpired",
      "inputs": [
        {
          "name": "timelock",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "current",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "TransferFailed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroAmount",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroBeneficiary",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroHashlock",
      "inputs": []
    }
  ],
  "CredentialRegistry": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "semaphore_",
          "type": "address",
          "internalType": "contract ISemaphore"
        },
        {
          "name": "initialOwner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "merkleTreeDuration",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "MAX_BATCH",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "acceptOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "addCredential",
      "inputs": [
        {
          "name": "identityCommitment",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "addCredentials",
      "inputs": [
        {
          "name": "identityCommitments",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "groupId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isAttester",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isConsumer",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isNullifierUsed",
      "inputs": [
        {
          "name": "scope",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "memberCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "merkleTreeRoot",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "pendingOwner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "releaseNullifier",
      "inputs": [
        {
          "name": "scope",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "renounceOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "revokeCredential",
      "inputs": [
        {
          "name": "identityCommitment",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "merkleProofSiblings",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "semaphore",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ISemaphore"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "setAttester",
      "inputs": [
        {
          "name": "attester",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setConsumer",
      "inputs": [
        {
          "name": "consumer",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "newOwner",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "verifyAndConsume",
      "inputs": [
        {
          "name": "proof",
          "type": "tuple",
          "internalType": "struct ISemaphore.SemaphoreProof",
          "components": [
            {
              "name": "merkleTreeDepth",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "merkleTreeRoot",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "nullifier",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "message",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "scope",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "points",
              "type": "uint256[8]",
              "internalType": "uint256[8]"
            }
          ]
        },
        {
          "name": "expectedScope",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "expectedMessage",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "nullifier",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "AttesterUpdated",
      "inputs": [
        {
          "name": "attester",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "ConsumerUpdated",
      "inputs": [
        {
          "name": "consumer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CredentialAdded",
      "inputs": [
        {
          "name": "identityCommitment",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "attester",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CredentialRevoked",
      "inputs": [
        {
          "name": "identityCommitment",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "attester",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "NullifierReleased",
      "inputs": [
        {
          "name": "consumer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "scope",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferStarted",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "ProofConsumed",
      "inputs": [
        {
          "name": "consumer",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "scope",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "BatchTooLarge",
      "inputs": [
        {
          "name": "size",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "max",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidProof",
      "inputs": []
    },
    {
      "type": "error",
      "name": "MessageMismatch",
      "inputs": [
        {
          "name": "expected",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "actual",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotAttester",
      "inputs": [
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotConsumer",
      "inputs": [
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "NullifierAlreadyUsed",
      "inputs": [
        {
          "name": "scope",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NullifierNotOwnedByCaller",
      "inputs": [
        {
          "name": "scope",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ScopeMismatch",
      "inputs": [
        {
          "name": "expected",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "actual",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    }
  ],
  "JurorSelection": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "vrfCoordinator",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "credentials_",
          "type": "address",
          "internalType": "contract ICredentialRegistry"
        },
        {
          "name": "staking_",
          "type": "address",
          "internalType": "contract ITokenStakingLocks"
        },
        {
          "name": "minPoolStake_",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "keyHash_",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "subscriptionId_",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "requestConfirmations_",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "callbackGasLimit_",
          "type": "uint32",
          "internalType": "uint32"
        },
        {
          "name": "nativePayment_",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "MAX_CALLBACK_GAS",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MAX_JURY",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MAX_POOL",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "acceptOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "callbackGasLimit",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "cancelSelection",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "credentials",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ICredentialRegistry"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "deregisterJuror",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getRequest",
      "inputs": [
        {
          "name": "requestId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct JurorSelection.Request",
          "components": [
            {
              "name": "disputeId",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "status",
              "type": "uint8",
              "internalType": "enum JurorSelection.RequestStatus"
            },
            {
              "name": "jurySize",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "stakePerJuror",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "excludedA",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "excludedB",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "randomWord",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isRegistered",
      "inputs": [
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "keyHash",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "minPoolStake",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "nativePayment",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "poolAt",
      "inputs": [
        {
          "name": "index",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "poolSize",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "previewSelection",
      "inputs": [
        {
          "name": "word",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "jurySize",
          "type": "uint8",
          "internalType": "uint8"
        },
        {
          "name": "stakePerJuror",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "exA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "exB",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "jurors",
          "type": "address[]",
          "internalType": "address[]"
        },
        {
          "name": "ok",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "rawFulfillRandomWords",
      "inputs": [
        {
          "name": "requestId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "randomWords",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "registerJuror",
      "inputs": [
        {
          "name": "proof",
          "type": "tuple",
          "internalType": "struct ISemaphore.SemaphoreProof",
          "components": [
            {
              "name": "merkleTreeDepth",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "merkleTreeRoot",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "nullifier",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "message",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "scope",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "points",
              "type": "uint256[8]",
              "internalType": "uint256[8]"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "removeJurorByOwner",
      "inputs": [
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "requestConfirmations",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "requestIdOf",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "requestSelection",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "jurySize",
          "type": "uint8",
          "internalType": "uint8"
        },
        {
          "name": "stakePerJuror",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "excludedA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "excludedB",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "requestId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "s_vrfCoordinator",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IVRFCoordinatorV2Plus"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "setCoordinator",
      "inputs": [
        {
          "name": "_vrfCoordinator",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setMinPoolStake",
      "inputs": [
        {
          "name": "minPoolStake_",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setVoting",
      "inputs": [
        {
          "name": "voting_",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setVrfConfig",
      "inputs": [
        {
          "name": "keyHash_",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "subscriptionId_",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "requestConfirmations_",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "callbackGasLimit_",
          "type": "uint32",
          "internalType": "uint32"
        },
        {
          "name": "nativePayment_",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "staking",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ITokenStakingLocks"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "subscriptionId",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "voting",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "CoordinatorSet",
      "inputs": [
        {
          "name": "vrfCoordinator",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "FulfillmentIgnored",
      "inputs": [
        {
          "name": "requestId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "status",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum JurorSelection.RequestStatus"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "JurorRegistered",
      "inputs": [
        {
          "name": "juror",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "poolSize",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "JurorRemoved",
      "inputs": [
        {
          "name": "juror",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "poolSize",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "byOwner",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "JurorsSelected",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "requestId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "jurors",
          "type": "address[]",
          "indexed": false,
          "internalType": "address[]"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "MinPoolStakeUpdated",
      "inputs": [
        {
          "name": "minPoolStake",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferRequested",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SelectionCancelled",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "requestId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SelectionFailed",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "requestId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "reason",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SelectionRequested",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "requestId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "jurySize",
          "type": "uint8",
          "indexed": false,
          "internalType": "uint8"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "VotingSet",
      "inputs": [
        {
          "name": "voting",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "VrfConfigUpdated",
      "inputs": [
        {
          "name": "keyHash",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        },
        {
          "name": "subscriptionId",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "confirmations",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "callbackGasLimit",
          "type": "uint32",
          "indexed": false,
          "internalType": "uint32"
        },
        {
          "name": "nativePayment",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AlreadyRegistered",
      "inputs": [
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "CallbackGasTooHigh",
      "inputs": [
        {
          "name": "given",
          "type": "uint32",
          "internalType": "uint32"
        },
        {
          "name": "max",
          "type": "uint32",
          "internalType": "uint32"
        }
      ]
    },
    {
      "type": "error",
      "name": "InsufficientPoolStake",
      "inputs": [
        {
          "name": "free",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "required",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidJurySize",
      "inputs": [
        {
          "name": "jurySize",
          "type": "uint8",
          "internalType": "uint8"
        }
      ]
    },
    {
      "type": "error",
      "name": "NoSuchSelection",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotRegistered",
      "inputs": [
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotVoting",
      "inputs": [
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OnlyCoordinatorCanFulfill",
      "inputs": [
        {
          "name": "have",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "want",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OnlyOwnerOrCoordinator",
      "inputs": [
        {
          "name": "have",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "coordinator",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "PoolFull",
      "inputs": [
        {
          "name": "max",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "PoolTooSmall",
      "inputs": [
        {
          "name": "poolSize",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "required",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SelectionAlreadyRequested",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "VotingAlreadySet",
      "inputs": []
    },
    {
      "type": "error",
      "name": "VotingNotSet",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    }
  ],
  "SchellingVoting": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "initialOwner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "selection_",
          "type": "address",
          "internalType": "contract IJurorSelection"
        },
        {
          "name": "staking_",
          "type": "address",
          "internalType": "contract ITokenStakingLocks"
        },
        {
          "name": "registry_",
          "type": "address",
          "internalType": "contract ISubmissionRegistry"
        },
        {
          "name": "config_",
          "type": "tuple",
          "internalType": "struct SchellingVoting.Config",
          "components": [
            {
              "name": "jurySize",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "minReveals",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "commitDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "revealDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "selectionTimeout",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "minorityPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "nonRevealPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "stakePerJuror",
              "type": "uint128",
              "internalType": "uint128"
            }
          ]
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "MAX_DURATION",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MAX_JURY",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MAX_PENALTY_BPS",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MIN_DURATION",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MIN_JURY",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "VOTE_TAG",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "acceptOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "cancelDispute",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "commitVote",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "commitment",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "commitmentFor",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "vote",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Vote"
        },
        {
          "name": "salt",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "config",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct SchellingVoting.Config",
          "components": [
            {
              "name": "jurySize",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "minReveals",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "commitDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "revealDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "selectionTimeout",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "minorityPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "nonRevealPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "stakePerJuror",
              "type": "uint128",
              "internalType": "uint128"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "createDispute",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "externalRef",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "excludedA",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "excludedB",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "disputeCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "finalize",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getDispute",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "info",
          "type": "tuple",
          "internalType": "struct SchellingVoting.DisputeInfo",
          "components": [
            {
              "name": "creator",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "status",
              "type": "uint8",
              "internalType": "enum ISchellingVoting.Status"
            },
            {
              "name": "outcome",
              "type": "uint8",
              "internalType": "enum ISchellingVoting.Outcome"
            },
            {
              "name": "createdAt",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "commitDeadline",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "revealDeadline",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "committed",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "revealedReal",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "revealedFake",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "submissionId",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "externalRef",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "cfg",
              "type": "tuple",
              "internalType": "struct SchellingVoting.Config",
              "components": [
                {
                  "name": "jurySize",
                  "type": "uint8",
                  "internalType": "uint8"
                },
                {
                  "name": "minReveals",
                  "type": "uint8",
                  "internalType": "uint8"
                },
                {
                  "name": "commitDuration",
                  "type": "uint32",
                  "internalType": "uint32"
                },
                {
                  "name": "revealDuration",
                  "type": "uint32",
                  "internalType": "uint32"
                },
                {
                  "name": "selectionTimeout",
                  "type": "uint32",
                  "internalType": "uint32"
                },
                {
                  "name": "minorityPenaltyBps",
                  "type": "uint16",
                  "internalType": "uint16"
                },
                {
                  "name": "nonRevealPenaltyBps",
                  "type": "uint16",
                  "internalType": "uint16"
                },
                {
                  "name": "stakePerJuror",
                  "type": "uint128",
                  "internalType": "uint128"
                }
              ]
            },
            {
              "name": "jurors",
              "type": "address[]",
              "internalType": "address[]"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isCreator",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "jurorsOf",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address[]",
          "internalType": "address[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "onJurorsSelected",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "jurors",
          "type": "address[]",
          "internalType": "address[]"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "onSelectionFailed",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "pendingOwner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "phaseOf",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Phase"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "registry",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ISubmissionRegistry"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "renounceOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "resultOf",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "status",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Status"
        },
        {
          "name": "outcome",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Outcome"
        },
        {
          "name": "creator",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "externalRef",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "revealVote",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "vote",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Vote"
        },
        {
          "name": "salt",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "selection",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IJurorSelection"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "setConfig",
      "inputs": [
        {
          "name": "config_",
          "type": "tuple",
          "internalType": "struct SchellingVoting.Config",
          "components": [
            {
              "name": "jurySize",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "minReveals",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "commitDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "revealDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "selectionTimeout",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "minorityPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "nonRevealPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "stakePerJuror",
              "type": "uint128",
              "internalType": "uint128"
            }
          ]
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setCreator",
      "inputs": [
        {
          "name": "creator",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "staking",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ITokenStakingLocks"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "newOwner",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "voteOf",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "selected",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "committed",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "revealed",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "vote",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Vote"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "ConfigUpdated",
      "inputs": [
        {
          "name": "config",
          "type": "tuple",
          "indexed": false,
          "internalType": "struct SchellingVoting.Config",
          "components": [
            {
              "name": "jurySize",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "minReveals",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "commitDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "revealDuration",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "selectionTimeout",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "minorityPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "nonRevealPenaltyBps",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "stakePerJuror",
              "type": "uint128",
              "internalType": "uint128"
            }
          ]
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CreatorUpdated",
      "inputs": [
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "allowed",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "DisputeCancelled",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "reason",
          "type": "string",
          "indexed": false,
          "internalType": "string"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "DisputeCreated",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "submissionId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "externalRef",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "selectionRequestId",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "DisputeFinalized",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "outcome",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum ISchellingVoting.Outcome"
        },
        {
          "name": "revealedReal",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "revealedFake",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "penaltyPool",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "recipients",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "JurorSettled",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "penalty",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "reward",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "JurorsSelected",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "jurors",
          "type": "address[]",
          "indexed": false,
          "internalType": "address[]"
        },
        {
          "name": "commitDeadline",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        },
        {
          "name": "revealDeadline",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferStarted",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "VoteCommitted",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "commitment",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "VoteRevealed",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "vote",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum ISchellingVoting.Vote"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AlreadyCommitted",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "AlreadyRevealed",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "CommitPhaseClosed",
      "inputs": [
        {
          "name": "deadline",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nowTs",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "CommitmentMismatch",
      "inputs": []
    },
    {
      "type": "error",
      "name": "EmptyCommitment",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidConfig",
      "inputs": [
        {
          "name": "reason",
          "type": "string",
          "internalType": "string"
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidJurorSet",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidStatus",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "status",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Status"
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidVote",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoCommitment",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "juror",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotCreator",
      "inputs": [
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotJuror",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotSelection",
      "inputs": [
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "RevealPhaseClosed",
      "inputs": [
        {
          "name": "deadline",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nowTs",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "RevealPhaseNotOver",
      "inputs": [
        {
          "name": "revealDeadline",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nowTs",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "RevealPhaseNotStarted",
      "inputs": [
        {
          "name": "commitDeadline",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nowTs",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "SelectionNotTimedOut",
      "inputs": [
        {
          "name": "availableAt",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nowTs",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "UnknownDispute",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "UnknownSubmission",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    }
  ],
  "ArbitratedBounty": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "htlc_",
          "type": "address",
          "internalType": "contract IHTLC"
        },
        {
          "name": "registry_",
          "type": "address",
          "internalType": "contract ISubmissionRegistry"
        },
        {
          "name": "voting_",
          "type": "address",
          "internalType": "contract ISchellingVoting"
        },
        {
          "name": "credentials_",
          "type": "address",
          "internalType": "contract ICredentialRegistry"
        },
        {
          "name": "minBounty_",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "minLockDuration_",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "MAX_OPENS",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "PREIMAGE_TAG",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "bountyCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "bountyOfDispute",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "credentials",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ICredentialRegistry"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "fundBounty",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "whistleblower",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "timelock",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "getBounty",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct ArbitratedBounty.Bounty",
          "components": [
            {
              "name": "submissionId",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "funder",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "whistleblower",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "lockId",
              "type": "bytes32",
              "internalType": "bytes32"
            },
            {
              "name": "timelock",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "status",
              "type": "uint8",
              "internalType": "enum ArbitratedBounty.Status"
            },
            {
              "name": "openCount",
              "type": "uint8",
              "internalType": "uint8"
            },
            {
              "name": "activeDispute",
              "type": "uint256",
              "internalType": "uint256"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "htlc",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IHTLC"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "minBounty",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "minLockDuration",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "openDispute",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "proof",
          "type": "tuple",
          "internalType": "struct ISemaphore.SemaphoreProof",
          "components": [
            {
              "name": "merkleTreeDepth",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "merkleTreeRoot",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "nullifier",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "message",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "scope",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "points",
              "type": "uint256[8]",
              "internalType": "uint256[8]"
            }
          ]
        }
      ],
      "outputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "pendingPayout",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "refund",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "registry",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ISubmissionRegistry"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "settle",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "voting",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract ISchellingVoting"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "withdraw",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "BountyFunded",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "submissionId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "funder",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "whistleblower",
          "type": "address",
          "indexed": false,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "lockId",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        },
        {
          "name": "timelock",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BountyRefunded",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "funder",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BountySettled",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "outcome",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum ISchellingVoting.Outcome"
        },
        {
          "name": "newStatus",
          "type": "uint8",
          "indexed": false,
          "internalType": "enum ArbitratedBounty.Status"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "DisputeOpened",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "disputeId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "attempt",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "nullifier",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PayoutCredited",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PayoutWithdrawn",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AmountTooSmall",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "min",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "DisputeLinkMismatch",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "DisputeNotResolved",
      "inputs": [
        {
          "name": "disputeId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "status",
          "type": "uint8",
          "internalType": "enum ISchellingVoting.Status"
        }
      ]
    },
    {
      "type": "error",
      "name": "DisputeWindowClosed",
      "inputs": [
        {
          "name": "timelock",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nowTs",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidStatus",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "status",
          "type": "uint8",
          "internalType": "enum ArbitratedBounty.Status"
        }
      ]
    },
    {
      "type": "error",
      "name": "LockTooShort",
      "inputs": [
        {
          "name": "timelock",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "minTimelock",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "MaxDisputesReached",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NothingToWithdraw",
      "inputs": []
    },
    {
      "type": "error",
      "name": "OnlyHtlc",
      "inputs": [
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TimelockNotExpired",
      "inputs": [
        {
          "name": "timelock",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "nowTs",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "TransferFailed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnknownBounty",
      "inputs": [
        {
          "name": "bountyId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "UnknownSubmission",
      "inputs": [
        {
          "name": "submissionId",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAddress",
      "inputs": []
    }
  ]
};
