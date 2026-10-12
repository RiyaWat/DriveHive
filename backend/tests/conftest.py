import os
import pytest

# Load backend/.env so MONGO_URL/DB_NAME are available
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:
    pass

# Ensure REACT_APP_BACKEND_URL is set for test code that needs the public URL
if not os.environ.get("REACT_APP_BACKEND_URL"):
    try:
        with open(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass


def pytest_collection_modifyitems(config, items):
    """Default asyncio mode for tests using @pytest.mark.asyncio."""
    pass
