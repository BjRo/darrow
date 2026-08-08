function fail(message) {
  print "goal-loop: invalid route configuration: " message > "/dev/stderr"
  exit 2
}

function skip_space() {
  while (position <= length(document) && substr(document, position, 1) ~ /[[:space:]]/)
    position++
}

function expect(character, actual) {
  skip_space()
  actual = substr(document, position, 1)
  if (actual != character)
    fail("expected " character " at byte " position)
  position++
}

function string_value(    result, character, escape) {
  skip_space()
  if (substr(document, position, 1) != "\"")
    fail("expected string at byte " position)
  position++
  result = ""
  while (position <= length(document)) {
    character = substr(document, position++, 1)
    if (character == "\"")
      return result
    if (character == "\\") {
      escape = substr(document, position++, 1)
      if (escape == "\"" || escape == "\\" || escape == "/")
        result = result escape
      else
        fail("unsupported string escape at byte " (position - 2))
    } else {
      if (character ~ /[[:cntrl:]]/)
        fail("control character in string at byte " (position - 1))
      result = result character
    }
  }
  fail("unterminated string")
}

function safe_value(name, value) {
  if (value !~ /^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    fail("unsafe or empty " name " value")
}

function route_object(    key, value, separator, field_count, route_key, field) {
  for (field in route)
    delete route[field]
  expect("{")
  skip_space()
  if (substr(document, position, 1) == "}")
    fail("route object must not be empty")

  while (1) {
    key = string_value()
    if (key != "host" && key != "profile" && key != "harness" &&
        key != "provider" && key != "model" && key != "effort" &&
        key != "fallbackModel" && key != "fallbackEffort")
      fail("unknown route field: " key)
    if (key in route)
      fail("duplicate route field: " key)
    expect(":")
    value = string_value()
    route[key] = value
    field_count++

    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "}")
      break
    if (separator != ",")
      fail("expected , or } at byte " (position - 1))
  }

  if (field_count != 8)
    fail("each route must contain exactly eight fields")
  safe_value("host", route["host"])
  safe_value("profile", route["profile"])
  safe_value("harness", route["harness"])
  safe_value("provider", route["provider"])
  safe_value("model", route["model"])
  safe_value("effort", route["effort"])
  safe_value("fallbackModel", route["fallbackModel"])
  safe_value("fallbackEffort", route["fallbackEffort"])

  route_key = route["host"] SUBSEP route["profile"]
  if (route_key in seen_route)
    fail("duplicate route for host=" route["host"] " profile=" route["profile"])
  seen_route[route_key] = 1

  records[++record_count] = route["host"] "\t" route["profile"] "\t" \
    route["harness"] "\t" route["provider"] "\t" route["model"] "\t" \
    route["effort"] "\t" route["fallbackModel"] "\t" route["fallbackEffort"]
}

function routes_array(    separator) {
  expect("[")
  skip_space()
  if (substr(document, position, 1) == "]")
    fail("routes array must not be empty")

  while (1) {
    route_object()
    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "]")
      break
    if (separator != ",")
      fail("expected , or ] at byte " (position - 1))
  }
}

function root_object(    key) {
  expect("{")
  key = string_value()
  if (key != "routes")
    fail("root object must contain only routes")
  expect(":")
  routes_array()
  expect("}")
  skip_space()
  if (position <= length(document))
    fail("unexpected content at byte " position)
}

{
  document = document $0 "\n"
}

END {
  if (document == "")
    fail("file is empty")
  position = 1
  root_object()
  for (record_index = 1; record_index <= record_count; record_index++)
    print records[record_index]
}
