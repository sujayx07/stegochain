"""
Lookup what owner_ids are stored for a given session_id.
Usage: python scripts/lookup_session.py <session_id>
"""
import sys
import pathlib
from pymongo import MongoClient

# Load env
env = {}
for raw in pathlib.Path(".env.production").read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    env[k.strip()] = v.strip()

session_id = sys.argv[1] if len(sys.argv) > 1 else "6a25fa11-b0fc-4095-b15d-1067b7b05fbf"

client = MongoClient(env["MONGO_URI"], serverSelectionTimeoutMS=8000)
db_name = env["MONGO_URI"].split("/")[-1].split("?")[0]
db = client[db_name]

print(f"\nLooking up session: {session_id}")
print(f"Database: {db_name}\n")

# Check transaction record
tx = db["transactions"].find_one({"session_id": session_id}, {"_id": 0, "k": 1, "n": 1, "file_type": 1, "status": 1, "sender_id": 1})
if tx:
    print(f"Transaction: k={tx.get('k')}, n={tx.get('n')}, file_type={tx.get('file_type')}, status={tx.get('status')}")
else:
    print("No transaction found for this session_id")

# Check keyshares
shares = list(db["keyshares"].find({"session_id": session_id}, {"_id": 0, "owner_id": 1, "share_index": 1, "k": 1, "n": 1}))
shares.sort(key=lambda x: x["share_index"])

print(f"Key shares found: {len(shares)}")
print()
print("Enter these Owner IDs on the Receive page (you need at least k of them):")
print("-" * 40)
for s in shares:
    print(f"  owner_id={s['owner_id']}  (share index {s['share_index']})")

if shares:
    k = shares[0]["k"]
    print()
    print(f"Minimum required: {k} owner IDs")
    print("Copy any", k, "of the above into the Owner IDs box:")
    for s in shares[:k]:
        print(f"  {s['owner_id']}")
