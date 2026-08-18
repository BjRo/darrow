function fail(message) {
  if (!failed)
    print "claude-route-json.awk: " message > "/dev/stderr"
  failed = 1
  exit 2
}

function skip_space() {
  while (substr(document, position, 1) ~ /[ \t\r\n]/)
    position++
}

function expect(token) {
  skip_space()
  if (substr(document, position, length(token)) != token)
    fail("expected " token " at byte " position)
  position += length(token)
}

function string_value(    value, character, escaped, hex) {
  skip_space()
  if (substr(document, position, 1) != "\"")
    fail("expected string at byte " position)
  position++
  value = ""
  while (position <= length(document)) {
    character = substr(document, position++, 1)
    if (character == "\"")
      return value
    if (character == "\\") {
      if (position > length(document))
        fail("unterminated escape at byte " position)
      escaped = substr(document, position++, 1)
      if (escaped == "\"" || escaped == "\\" || escaped == "/" ||
          escaped == "b" || escaped == "f" || escaped == "n" ||
          escaped == "r" || escaped == "t") {
        value = value "\\" escaped
        continue
      }
      if (escaped == "u") {
        hex = substr(document, position, 4)
        if (length(hex) != 4 || hex !~ /^[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]$/)
          fail("invalid unicode escape at byte " (position - 2))
        value = value "\\u" hex
        position += 4
        continue
      }
      fail("invalid escape at byte " (position - 2))
    }
    if (character ~ /[[:cntrl:]]/)
      fail("unescaped control character at byte " (position - 1))
    value = value character
  }
  fail("unterminated string")
}

function skip_number(    remaining) {
  remaining = substr(document, position)
  if (!match(remaining, /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/))
    fail("invalid number at byte " position)
  position += RLENGTH
}

function skip_array(    separator) {
  expect("[")
  skip_space()
  if (substr(document, position, 1) == "]") {
    position++
    return
  }
  while (1) {
    skip_value()
    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "]")
      return
    if (separator != ",")
      fail("expected , or ] at byte " (position - 1))
  }
}

function skip_object(    key, separator) {
  expect("{")
  skip_space()
  if (substr(document, position, 1) == "}") {
    position++
    return
  }
  while (1) {
    key = string_value()
    expect(":")
    skip_value()
    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "}")
      return
    if (separator != ",")
      fail("expected , or } at byte " (position - 1))
  }
}

function skip_value(    character) {
  skip_space()
  character = substr(document, position, 1)
  if (character == "\"") {
    string_value()
    return
  }
  if (character == "{") {
    skip_object()
    return
  }
  if (character == "[") {
    skip_array()
    return
  }
  if (substr(document, position, 4) == "true" ||
      substr(document, position, 4) == "null") {
    position += 4
    return
  }
  if (substr(document, position, 5) == "false") {
    position += 5
    return
  }
  skip_number()
}

function message_object(    key, separator) {
  expect("{")
  skip_space()
  if (substr(document, position, 1) == "}") {
    position++
    return
  }
  while (1) {
    key = string_value()
    expect(":")
    if (key == "model") {
      if (message_model_seen++)
        fail("duplicate message.model")
      message_model = string_value()
    } else if (key == "role") {
      if (message_role_seen++)
        fail("duplicate message.role")
      message_role = string_value()
    } else {
      skip_value()
    }
    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "}")
      return
    if (separator != ",")
      fail("expected , or } at byte " (position - 1))
  }
}

function root_object(    key, separator) {
  expect("{")
  skip_space()
  if (substr(document, position, 1) == "}") {
    position++
    return
  }
  while (1) {
    key = string_value()
    expect(":")
    if (key == "type") {
      if (root_type_seen++)
        fail("duplicate type")
      root_type = string_value()
    } else if (key == "agentId") {
      if (agent_id_seen++)
        fail("duplicate agentId")
      root_agent_id = string_value()
    } else if (key == "effort") {
      if (effort_seen++)
        fail("duplicate effort")
      root_effort = string_value()
    } else if (key == "message") {
      if (message_seen++)
        fail("duplicate message")
      message_object()
    } else {
      skip_value()
    }
    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "}")
      return
    if (separator != ",")
      fail("expected , or } at byte " (position - 1))
  }
}

BEGIN {
  if (expected_agent_id == "")
    fail("expected_agent_id is required")
}

{
  document = $0
  position = 1
  root_type = ""
  root_agent_id = ""
  root_effort = ""
  message_model = ""
  message_role = ""
  root_type_seen = 0
  agent_id_seen = 0
  effort_seen = 0
  message_seen = 0
  message_model_seen = 0
  message_role_seen = 0
  if (document == "")
    fail("empty JSONL record at line " NR)
  root_object()
  skip_space()
  if (position <= length(document))
    fail("unexpected content at byte " position " on line " NR)
  if (root_type == "assistant") {
    if (root_agent_id != expected_agent_id)
      fail("assistant record has unexpected agentId on line " NR)
    if (message_role != "assistant")
      fail("assistant record has unexpected message.role on line " NR)
    if (message_model == "" || root_effort == "")
      fail("assistant record lacks model or effort on line " NR)
    print message_model "\t" root_effort
    observations++
  }
}

END {
  if (failed)
    exit 2
  if (!observations) {
    print "claude-route-json.awk: no assistant observations" > "/dev/stderr"
    exit 2
  }
}
