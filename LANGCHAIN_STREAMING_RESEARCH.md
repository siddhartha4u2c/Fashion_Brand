# LangChain & LangGraph Streaming Research

## 1. How to Use `.stream()` Method on Agents

### Basic Sync Streaming Pattern
```python
# Using stream_events with version="v3" for comprehensive event streaming
for event in agent.stream_events(
    {"messages": [HumanMessage("your question")]},
    version="v3"
):
    # Process events
    pass

# Using stream() with stream_mode parameter
for chunk, metadata in agent.stream(
    {"messages": [HumanMessage("your question")]},
    stream_mode="messages"  # or "values", "tools", "custom"
):
    # Process chunks
    pass
```

### Async Streaming Pattern
```python
async for event in agent.astream_events(
    {"messages": [HumanMessage("your question")]},
    version="v3"
):
    # Process events
    pass

async for chunk, metadata in agent.astream(
    {"messages": [HumanMessage("your question")]},
    stream_mode="messages"
):
    # Process chunks
    pass
```

### Tool-Specific Streaming (v3 - Recommended)
```python
# Stream tool call lifecycle events
run = agent.stream_events(
    {"messages": [HumanMessage("use tools")]},
    version="v3"
)

# Access tool calls projection (requires v3)
for tool_call_stream in run.tool_calls:
    tool_name = tool_call_stream.tool_name
    tool_call_id = tool_call_stream.tool_call_id
    
    # Iterate output deltas as they arrive
    for delta in tool_call_stream.output_deltas:
        print(f"Delta: {delta}")
    
    # Get final output
    output = tool_call_stream.output
    error = tool_call_stream.error  # If tool failed
    completed = tool_call_stream.completed
```

---

## 2. Capturing Intermediate Events

### Two Main Approaches

#### Approach 1: `astream_events()` - Event-Based (Recommended)
```python
from langchain_core.messages import HumanMessage

events = []
async for event in agent.astream_events(
    {"messages": [HumanMessage("What's the weather?")]},
    version="v3"  # v2 or v1 also available
):
    events.append(event)
    
    # Each event has this structure:
    # {
    #   "event": "on_tool_start" | "on_tool_end" | "on_chain_stream" | etc,
    #   "data": {...},
    #   "run_id": "...",
    #   "name": "tool_name",
    #   "tags": [],
    #   "metadata": {},
    #   "parent_ids": []
    # }
```

#### Approach 2: `stream()` with stream_mode - Stream-Based
```python
# Capture different stream modes
for namespace, mode, payload in agent.stream(
    {"messages": [HumanMessage("use tools")]},
    stream_mode=["messages", "tools", "values"],
    subgraphs=True
):
    if mode == "messages":
        # Yield messages as they appear
        message, metadata = payload
        
    elif mode == "tools":
        # Tool events like:
        # {
        #   "event": "tool-started",
        #   "tool_call_id": "call_123",
        #   "tool_name": "search",
        #   "input": {...}
        # }
        # {
        #   "event": "tool-output-delta",
        #   "tool_call_id": "call_123",
        #   "delta": "partial result"
        # }
        # {
        #   "event": "tool-finished",
        #   "tool_call_id": "call_123",
        #   "output": "final result"
        # }
        # {
        #   "event": "tool-error",
        #   "tool_call_id": "call_123",
        #   "message": "error message"
        # }
        pass
        
    elif mode == "values":
        # Full state at checkpoint
        state = payload
```

---

## 3. Event Structure Returned by `.stream()`

### Event v3 Structure (Recommended)
```python
{
    "event": str,           # Event type (see section 4 below)
    "data": {
        "input": Any,       # Input to the runnable
        "output": Any,      # Output from the runnable (for end events)
        "chunk": Any,       # Streaming chunk (for stream events)
    },
    "run_id": str,          # Unique ID for this run
    "name": str,            # Name of the runnable
    "tags": List[str],      # Tags attached to the runnable
    "metadata": Dict,       # Metadata dict
    "parent_ids": List[str] # IDs of parent runs
}
```

### Tool Event Structure (stream_mode="tools")
```python
# Tool Started Event
{
    "event": "tool-started",
    "tool_call_id": "call_1",
    "tool_name": "search",
    "input": {"query": "langchain"},
    "namespace": ("agent", "tools_task_1")  # Namespacing for nested agents
}

# Tool Output Delta Event (streaming partial output)
{
    "event": "tool-output-delta",
    "tool_call_id": "call_1",
    "delta": "partial result...",  # Chunk of output
}

# Tool Finished Event
{
    "event": "tool-finished",
    "tool_call_id": "call_1",
    "output": "full result from tool"
}

# Tool Error Event
{
    "event": "tool-error",
    "tool_call_id": "call_1",
    "message": "Tool execution failed",
    "code": "tool_error"  # Optional error code
}
```

### Message Event Structure (stream_mode="messages")
```python
# Message Start Event
{
    "event": "message-start",
    "id": "msg-1",
    "role": "ai",
    "metadata": {"langgraph_node": "agent"}
}

# Message Text Delta Event (token streaming)
{
    "event": "message-text-delta",
    "text": "The ",  # Streamed token/text
    "index": 0,
    "message_id": "msg-1"
}

# Message Finish Event
{
    "event": "message-finish",
    "input_tokens": 150,
    "output_tokens": 45,
    "message_id": "msg-1"
}
```

---

## 4. How to Handle Different Event Types

### Event Type Names You'll Encounter

#### Tool-Related Events (stream_mode="tools")
- `tool-started`: Tool execution begins
- `tool-output-delta`: Partial output from streaming tools
- `tool-finished`: Tool execution completed successfully
- `tool-error`: Tool execution failed

#### LLM/Message Events (stream_mode="messages" or astream_events)
- `on_llm_start`: LLM call begins
- `on_llm_stream`: LLM streaming token
- `on_llm_end`: LLM call completed
- `on_chat_model_start`: Chat model call starts
- `on_chat_model_stream`: Chat model stream event

#### Chain/Runnable Events
- `on_chain_start`: Chain execution begins
- `on_chain_stream`: Chain streaming output
- `on_chain_end`: Chain execution completed
- `on_tool_start`: Tool execution begins
- `on_tool_stream`: Tool streaming output
- `on_tool_end`: Tool execution completed

#### Lifecycle Events
- `message-start`: Message event begins
- `message-text-delta`: Token from message
- `message-finish`: Message event ends

### Filtering and Handling Events

```python
from langchain_core.messages import HumanMessage

async for event in agent.astream_events(
    {"messages": [HumanMessage("your query")]},
    version="v3"
):
    event_type = event.get("event")
    
    # Handle tool events
    if event_type == "on_tool_start":
        tool_name = event.get("name")
        inputs = event.get("data", {}).get("input")
        print(f"Tool {tool_name} started with: {inputs}")
    
    elif event_type == "on_tool_stream":
        chunk = event.get("data", {}).get("chunk")
        print(f"Tool output chunk: {chunk}")
    
    elif event_type == "on_tool_end":
        output = event.get("data", {}).get("output")
        print(f"Tool result: {output}")
    
    # Handle LLM events
    elif event_type == "on_llm_stream":
        chunk = event.get("data", {}).get("chunk")
        print(f"LLM token: {chunk.content if hasattr(chunk, 'content') else chunk}")
    
    # Handle chain events
    elif event_type == "on_chain_end":
        result = event.get("data", {}).get("output")
        print(f"Chain completed: {result}")
```

---

## 5. Code Examples for True Streaming with Agents

### Complete Example 1: Stream Tool Calls in Real-Time
```python
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

@tool
def search(query: str) -> str:
    """Search for information."""
    return f"Results for {query}"

@tool
def calculate(expression: str) -> str:
    """Calculate mathematical expressions."""
    return f"Result: {eval(expression)}"

# Create agent
model = ChatOpenAI(model="gpt-4")
agent = create_agent(
    model,
    tools=[search, calculate],
    name="my_agent"
)

# Stream with tool event projection (v3)
run = agent.stream_events(
    {"messages": [HumanMessage("Search for langchain and calculate 5+5")]},
    version="v3"
)

# Collect tool calls with deltas
for tool_call_stream in run.tool_calls:
    print(f"\n📌 Tool: {tool_call_stream.tool_name}")
    print(f"   ID: {tool_call_stream.tool_call_id}")
    print(f"   Input: {tool_call_stream.input}")
    
    # Stream tool output deltas
    print(f"   Output deltas: ", end="", flush=True)
    for delta in tool_call_stream.output_deltas:
        print(delta, end="", flush=True)
    print()
    
    if tool_call_stream.completed:
        print(f"   Final: {tool_call_stream.output}")
    if tool_call_stream.error:
        print(f"   ERROR: {tool_call_stream.error}")
```

### Complete Example 2: Handle All Event Types
```python
async def stream_agent_with_all_events():
    from langchain_core.messages import HumanMessage
    
    query = "What's 2+2? Search for Python documentation."
    
    events_by_type = {
        "tool_events": [],
        "llm_events": [],
        "chain_events": [],
        "message_events": []
    }
    
    async for event in agent.astream_events(
        {"messages": [HumanMessage(query)]},
        version="v3"
    ):
        event_type = event.get("event", "")
        name = event.get("name", "unknown")
        
        # Categorize and collect
        if "tool" in event_type:
            events_by_type["tool_events"].append({
                "type": event_type,
                "name": name,
                "data": event.get("data")
            })
            print(f"🔧 Tool: {event_type} - {name}")
            
        elif "llm" in event_type or "chat_model" in event_type:
            events_by_type["llm_events"].append(event)
            if event_type == "on_llm_stream":
                chunk = event.get("data", {}).get("chunk", {})
                content = chunk.content if hasattr(chunk, 'content') else str(chunk)
                print(f"🤖 LLM token: {content}", end="", flush=True)
            else:
                print(f"🤖 {event_type}")
                
        elif "chain" in event_type:
            events_by_type["chain_events"].append(event)
            print(f"⛓️  Chain: {event_type}")
            
        elif "message" in event_type:
            events_by_type["message_events"].append(event)
            if "delta" in event_type:
                text = event.get("data", {}).get("chunk", {}).get("text", "")
                print(f"💬 Message delta: {text}", end="", flush=True)
    
    return events_by_type
```

### Complete Example 3: Stream Multiple Events with Namespace
```python
def stream_with_filtering():
    """Stream only specific event types with namespace filtering."""
    
    for namespace, mode, payload in agent.stream(
        {"messages": [HumanMessage("use a tool")]},
        stream_mode=["messages", "tools", "values"],
        subgraphs=True
    ):
        # namespace is a list like ["agent"] or ["agent", "tools:call_1"]
        # mode is "messages", "tools", or "values"
        
        if mode == "tools":
            event = payload
            tool_call_id = event.get("tool_call_id")
            event_type = event.get("event")
            
            if event_type == "tool-started":
                print(f"\n🚀 Starting tool: {event.get('tool_name')}")
                print(f"   Args: {event.get('input')}")
                
            elif event_type == "tool-output-delta":
                # Stream output as it arrives
                delta = event.get("delta")
                print(f"📤 {delta}", end="", flush=True)
                
            elif event_type == "tool-finished":
                print(f"\n✅ Tool completed")
                print(f"   Output: {event.get('output')}")
                
            elif event_type == "tool-error":
                print(f"\n❌ Tool error: {event.get('message')}")
                
        elif mode == "messages":
            message, metadata = payload
            print(f"\n💬 Message: {message.content[:100]}...")
            
        elif mode == "values":
            # Full state snapshot
            state = payload
            print(f"\n📊 State checkpoint: {state.keys()}")
```

### Complete Example 4: Token-by-Token LLM Streaming
```python
async def stream_llm_tokens_only():
    """Capture and display LLM tokens as they stream."""
    
    token_buffer = []
    
    async for event in agent.astream_events(
        {"messages": [HumanMessage("explain what agents are")]},
        version="v3"
    ):
        event_type = event.get("event", "")
        
        # Only process LLM streaming events
        if event_type in ["on_llm_stream", "on_chat_model_stream"]:
            chunk = event.get("data", {}).get("chunk")
            
            if hasattr(chunk, 'content'):
                # AIMessageChunk has content attribute
                token = chunk.content
                token_buffer.append(token)
                print(token, end="", flush=True)
            elif isinstance(chunk, str):
                token_buffer.append(chunk)
                print(chunk, end="", flush=True)
    
    full_response = "".join(token_buffer)
    print(f"\n\nFull response: {full_response}")
    return full_response
```

### Complete Example 5: Nested Agent Tool Calls (Hierarchical)
```python
async def stream_nested_agents():
    """Handle nested agents invoking sub-agents through tools."""
    
    async for namespace, mode, payload in agent.astream(
        {"messages": [HumanMessage("delegate to subagent")]},
        stream_mode="tools",
        subgraphs=True  # Important for nested agents
    ):
        # namespace like: ["outer", "tools:tc1", "inner"]
        #                 ^outer agent  ^tool call  ^inner agent
        
        if len(namespace) > 1 and "tools:" in namespace[1]:
            # This is a tool call event
            event = payload
            tool_name = event.get("tool_name")
            
            # Track which agent is calling the tool
            calling_agent = namespace[0]
            
            if event.get("event") == "tool-started":
                print(f"🔗 {calling_agent} → calling {tool_name}")
                
            elif event.get("event") == "tool-finished":
                print(f"✅ {calling_agent} ← got result from {tool_name}")
```

---

## 6. Event Type Names Reference

### Complete Event Type List

#### From LangChain Core Callbacks
```
on_llm_start           # LLM call begins
on_llm_new_token       # New token streamed from LLM  
on_llm_stream          # LLM stream chunk
on_llm_end             # LLM call completed
on_llm_error           # LLM call failed

on_chat_model_start    # Chat model call begins
on_chat_model_stream   # Chat model stream chunk
on_chat_model_end      # Chat model call completed

on_chain_start         # Chain begins
on_chain_stream        # Chain stream chunk
on_chain_end           # Chain completed
on_chain_error         # Chain failed

on_tool_start          # Tool execution begins
on_tool_stream         # Tool output stream chunk
on_tool_end            # Tool execution completed
on_tool_error          # Tool execution failed

on_retriever_start     # Retriever call begins
on_retriever_end       # Retriever call completed

on_agent_action        # Agent takes action (deprecated)
on_agent_finish        # Agent finishes (deprecated)
```

#### From LangGraph Stream Mode="tools"
```
tool-started           # Tool execution begins
tool-output-delta      # Partial tool output (streaming)
tool-finished          # Tool execution completed
tool-error             # Tool execution failed
```

#### From LangGraph Stream Mode="messages"
```
message-start          # Message stream begins
message-text-delta     # Text token from message
message-finish         # Message stream ends
message-error          # Message generation failed
```

#### From LangGraph Lifecycle Events
```
started                # Subgraph started
completed              # Subgraph completed
failed                 # Subgraph failed
interrupted            # Subgraph interrupted
```

---

## Key Takeaways

1. **Use `stream_events(version="v3")` for comprehensive streaming** - Most modern and feature-rich
2. **Tool calls have dedicated `stream_mode="tools"`** - Better than trying to parse tool events manually
3. **Namespaces enable tracking nested/hierarchical agents** - Key for multi-agent systems
4. **Four main event categories**: tools, messages, values, custom
5. **Always use `subgraphs=True`** when you have nested agents or sub-agents
6. **Tool delta streaming requires tools mode or v3 events** - Essential for responsive UX
7. **Events are ordered by arrival** - First `on_tool_start`, then deltas, then `on_tool_end`

