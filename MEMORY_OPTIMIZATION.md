# Memory Optimization & Fixes for StegoChain Backend

## Issue

Web Service `stegochain1` exceeded its memory limit on Render, causing automatic restarts.

## Root Causes Identified

1. **Debug mode enabled in production** — Flask debug mode doubled memory usage
2. **No max request limits** — Gunicorn workers never recycled, causing memory leak
3. **Large files loaded entirely into memory** — IPFS retrieval and image processing
4. **MongoDB connection timeout issues** — Could accumulate connection attempts
5. **No garbage collection** — Memory not freed after processing large files
6. **No file upload limits** — Could accept unbounded file sizes

## Fixes Applied

### 1. **Disabled Flask Debug Mode** (app.py)

```python
# BEFORE: app.run(debug=True, use_reloader=False, ...)
# AFTER:
app.run(debug=False, use_reloader=False, ...)
```

Debug mode hooks into all Python code execution and doubles memory footprint.

### 2. **Added Gunicorn Worker Recycling** (render.yaml)

```yaml
startCommand: "gunicorn --workers 2 --worker-class sync --timeout 120 --max-requests 100 --max-requests-jitter 10 ..."
```

- `--max-requests 100`: Recycle worker after 100 requests
- `--max-requests-jitter 10`: Stagger recycling to avoid simultaneous restarts
- `--worker-class sync`: Use synchronous worker (better for this workload)

This prevents long-lived memory leaks from accumulating.

### 3. **Streaming IPFS Retrieval** (modules/ipfs/pinata.py)

```python
# BEFORE: response.content (loads entire file into memory)
# AFTER: response.iter_content(chunk_size=8192) (streams in 8KB chunks)
```

Large media files no longer spike memory usage.

### 4. **File Upload Size Limit** (app.py)

```python
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB limit
```

Prevents users from uploading files larger than instance can handle.

### 5. **MongoDB Connection Timeout** (app.py)

```python
client = MongoClient(
    mongo_uri,
    serverSelectionTimeoutMS=5000,   # New: 5s timeout
    connectTimeoutMS=5000              # New: 5s timeout
)
```

Prevents hanging connections that accumulate memory.

### 6. **Automatic Garbage Collection** (app.py)

```python
@app.after_request
def after_request(response):
    gc.collect()  # Force cleanup after each request
    return response
```

## Deployment Steps

1. **Commit and push changes:**

   ```bash
   git add -A
   git commit -m "fix: optimize memory usage and disable debug mode"
   git push
   ```

2. **Redeploy to Render:**
   - Visit https://dashboard.render.com
   - Go to your `stegochain-backend` service
   - Click **"Manual Deploy"** or wait for auto-deploy on push
   - Monitor the **Logs** tab for startup messages

3. **Verify the fix:**
   ```bash
   curl https://stegochain-backend-xxx.onrender.com/health
   ```
   Should return `{"status": "ok", ...}`

## Monitoring

Watch these metrics in Render dashboard:

- **Memory**: Should stay under instance limit
- **Restart count**: Should stop increasing
- **CPU**: Should be normal (not spiking)
- **Logs**: Should show no memory errors

## If Memory Still Exceeds Limit

1. **Check logs for traffic spikes:**

   ```bash
   # In Render dashboard: Logs tab
   # Look for patterns in request volume
   ```

2. **Reduce worker count temporarily:**

   ```yaml
   startCommand: "gunicorn --workers 1 ..." # Single worker uses less memory
   ```

3. **Upgrade Render instance:**
   - Current: Check your plan (likely Pro = 512MB or higher)
   - Upgrade to: Pro (512MB RAM), Starter+ (1GB), or standard (2GB)
   - In Render dashboard: Settings → Instance Type

4. **Profile memory usage locally:**

   ```bash
   # Install memory_profiler
   pip install memory-profiler

   # Run with profiling
   python -m memory_profiler app.py
   ```

## Additional Optimization (Future)

- Implement Redis caching for frequently accessed IPFS files
- Add request rate limiting to prevent DOS
- Implement proper async/await for I/O operations
- Monitor and clean up old temp files in `/tmp/stegochain`

## Files Modified

- `backend/app.py` — Debug mode, MAX_CONTENT_LENGTH, MongoDB timeout, garbage collection
- `backend/modules/ipfs/pinata.py` — Streaming for large files
- `render.yaml` — Gunicorn worker recycling settings
