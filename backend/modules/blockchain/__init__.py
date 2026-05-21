# blockchain/__init__.py
# Lazy imports to avoid circular/version conflicts at module load time.
# Import directly from web3_client or web3_v2 as needed.

def __getattr__(name):
    from . import web3_client, web3_v2
    for mod in (web3_v2, web3_client):
        if hasattr(mod, name):
            return getattr(mod, name)
    raise AttributeError(f"module 'blockchain' has no attribute {name!r}")
