function fail(message) {
  print "review-route: invalid reviewer configuration: " message > "/dev/stderr"
  exit 2
}

function skip_space(    character) {
  while (position <= length(document)) {
    character = substr(document, position, 1)
    if (character == " " || character == "\t" || character == "\r" || character == "\n")
      position++
    else
      break
  }
}

function expect(character, actual) {
  skip_space()
  actual = substr(document, position, 1)
  if (actual != character)
    fail("expected " character " at byte " position)
  position++
}

function decoded_unicode(hex,    digits, value, index_value, digit) {
  digits = "0123456789abcdef"
  value = 0
  for (index_value = 1; index_value <= 4; index_value++) {
    digit = index(digits, tolower(substr(hex, index_value, 1))) - 1
    value = value * 16 + digit
  }
  if (value >= 32 && value <= 126)
    return sprintf("%c", value)
  return "\\u" hex
}

function string_value(    result, character, escape, hex) {
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
      else if (escape == "b" || escape == "f" || escape == "n" ||
               escape == "r" || escape == "t")
        result = result "\\" escape
      else if (escape == "u") {
        hex = substr(document, position, 4)
        if (length(hex) != 4 || hex !~ /^[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]$/)
          fail("invalid unicode escape at byte " (position - 2))
        result = result decoded_unicode(hex)
        position += 4
      } else
        fail("invalid string escape at byte " (position - 2))
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

function skip_number(    character) {
  if (substr(document, position, 1) == "-")
    position++

  character = substr(document, position, 1)
  if (character == "0") {
    position++
    if (substr(document, position, 1) ~ /[0-9]/)
      fail("invalid JSON number at byte " position)
  } else if (character ~ /[1-9]/) {
    while (substr(document, position, 1) ~ /[0-9]/)
      position++
  } else {
    fail("invalid JSON number at byte " position)
  }

  if (substr(document, position, 1) == ".") {
    position++
    if (substr(document, position, 1) !~ /[0-9]/)
      fail("invalid JSON number at byte " position)
    while (substr(document, position, 1) ~ /[0-9]/)
      position++
  }

  character = substr(document, position, 1)
  if (character == "e" || character == "E") {
    position++
    character = substr(document, position, 1)
    if (character == "+" || character == "-")
      position++
    if (substr(document, position, 1) !~ /[0-9]/)
      fail("invalid JSON number at byte " position)
    while (substr(document, position, 1) ~ /[0-9]/)
      position++
  }
}

function skip_literal(literal) {
  if (substr(document, position, length(literal)) != literal)
    fail("invalid JSON value at byte " position)
  position += length(literal)
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

function skip_object(    separator) {
  expect("{")
  skip_space()
  if (substr(document, position, 1) == "}") {
    position++
    return
  }
  while (1) {
    string_value()
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
  if (character == "\"")
    string_value()
  else if (character == "{")
    skip_object()
  else if (character == "[")
    skip_array()
  else if (character == "t")
    skip_literal("true")
  else if (character == "f")
    skip_literal("false")
  else if (character == "n")
    skip_literal("null")
  else if (character ~ /[-0-9]/)
    skip_number()
  else
    fail("invalid JSON value at byte " position)
}

function reviewer_object(    key, value, separator, field_count, field) {
  for (field in reviewer)
    delete reviewer[field]
  field_count = 0
  expect("{")
  skip_space()
  if (substr(document, position, 1) == "}")
    fail("reviewer object must not be empty")

  while (1) {
    key = string_value()
    if (key != "host" && key != "harness" && key != "provider" &&
        key != "model" && key != "effort")
      fail("unknown reviewer field: " key)
    if (key in reviewer)
      fail("duplicate reviewer field: " key)
    expect(":")
    value = string_value()
    reviewer[key] = value
    field_count++

    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "}")
      break
    if (separator != ",")
      fail("expected , or } at byte " (position - 1))
  }

  if (field_count != 5)
    fail("each reviewer must contain exactly five fields")
  safe_value("host", reviewer["host"])
  safe_value("harness", reviewer["harness"])
  safe_value("provider", reviewer["provider"])
  safe_value("model", reviewer["model"])
  safe_value("effort", reviewer["effort"])
  if (reviewer["host"] in seen_host)
    fail("duplicate reviewer for host=" reviewer["host"])
  seen_host[reviewer["host"]] = 1

  records[++record_count] = reviewer["host"] "\t" reviewer["harness"] "\t" \
    reviewer["provider"] "\t" reviewer["model"] "\t" reviewer["effort"]
}

function reviewers_array(    separator) {
  expect("[")
  skip_space()
  if (substr(document, position, 1) == "]") {
    if (!allow_missing_reviewers)
      fail("bundled reviewers array must not be empty")
    position++
    return
  }
  while (1) {
    reviewer_object()
    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "]")
      break
    if (separator != ",")
      fail("expected , or ] at byte " (position - 1))
  }
}

function root_object(    key, separator) {
  expect("{")
  skip_space()
  if (substr(document, position, 1) == "}") {
    position++
    skip_space()
    if (position <= length(document))
      fail("unexpected content at byte " position)
    if (!allow_missing_reviewers)
      fail("root object must contain reviewers")
    return
  }
  while (1) {
    key = string_value()
    if (key != "routes" && key != "reviewers")
      fail("unknown root field: " key)
    if (key in seen_root)
      fail("duplicate root field: " key)
    seen_root[key] = 1
    expect(":")
    if (key == "reviewers") {
      reviewers_array()
      found_reviewers = 1
    } else {
      skip_value()
    }
    skip_space()
    separator = substr(document, position++, 1)
    if (separator == "}")
      break
    if (separator != ",")
      fail("expected , or } at byte " (position - 1))
  }
  skip_space()
  if (position <= length(document))
    fail("unexpected content at byte " position)
  if (!found_reviewers && !allow_missing_reviewers)
    fail("root object must contain reviewers")
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
