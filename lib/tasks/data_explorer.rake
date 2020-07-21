# frozen_string_literal: true

require 'rainbow'

# rake data_explorer:list_hidden_queries
desc "Shows a list of hidden queries"
task 'data_explorer:list_hidden_queries' => :environment do |t|
  hidden_queries = []
  puts " "
  puts Rainbow("Hidden Queries").green.bright
  puts " "

  DataExplorer::Query.all.each do |query|
    hidden_queries.push(query) if query.hidden
  end

  hidden_queries.each do |query|
    puts Rainbow("Name: #{query.name}").green
    puts Rainbow("Description: #{query.description}").green
    puts Rainbow("ID: ").green + Rainbow(query.id).yellow.bright
    puts " "
  end
end

# rake data_explorer[-1]
# rake data_explorer[1,-2,3,-4,5]
desc "Hides one or multiple queries by ID"
task 'data_explorer' => :environment do |t, args|
  puts " "
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts Rainbow("Error finding query with id #{id}").red
      puts " "
    else
      q = DataExplorer::Query.find(id)
      if q
        puts Rainbow("Found query with id #{id}").green
      end

      q.hidden = true
      q.save
      puts Rainbow("Query no.#{id} is now hidden").green if q.hidden
      puts " "
    end
  end
end

# rake data_explorer:unhide_query[-1]
# rake data_explorer:unhide_query[1,-2,3,-4,5]
desc "Unhides one or multiple queries by ID"
task 'data_explorer:unhide_query' => :environment do |t, args|
  puts " "
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts Rainbow("Error finding query with id #{id}").red
      puts " "
    else
      q = DataExplorer::Query.find(id)
      if q
        puts Rainbow("Found query with id #{id}").green
      end

      q.hidden = false
      q.save
      puts Rainbow("Query no.#{id} is now visible").green unless q.hidden
      puts " "
    end
  end
end

# rake data_explorer:hard_delete[-1]
# rake data_explorer:hard_delete[1,-2,3,-4,5]
desc "Hard deletes one or multiple queries by ID"
task 'data_explorer:hard_delete' => :environment do |t, args|
  puts " "
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts Rainbow("Error finding query with id #{id}").red
      puts " "
    else
      q = DataExplorer::Query.find(id)
      if q
        puts Rainbow("Found query with id #{id}").green
      end

      if q.hidden
        DataExplorer.pstore_delete "q:#{id}"
        puts Rainbow("Query no.#{id} has been deleted").green
        puts " "
      else
        puts Rainbow("Query no.#{id} must be hidden in order to hard delete").red
        puts Rainbow("To hide the query, run: ").yellow + Rainbow("rake data_explorer[#{id}]").yellow.bright
        puts " "
      end
    end
  end
end
