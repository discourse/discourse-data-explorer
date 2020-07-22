# frozen_string_literal: true

# rake data_explorer:list_hidden_queries
desc "Shows a list of hidden queries"
task 'data_explorer:list_hidden_queries' => :environment do |t|
  hidden_queries = []
  puts " "
  puts "Hidden Queries"
  puts " "

  DataExplorer::Query.all.each do |query|
    hidden_queries.push(query) if query.hidden
  end

  hidden_queries.each do |query|
    puts "Name: #{query.name}"
    puts "Description: #{query.description}"
    puts "ID: #{query.id}"
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
      puts "Error finding query with id #{id}"
      puts " "
    else
      q = DataExplorer::Query.find(id)
      if q
        puts "Found query with id #{id}"
      end

      q.hidden = true
      q.save
      puts "Query no.#{id} is now hidden" if q.hidden
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
      puts "Error finding query with id #{id}"
      puts " "
    else
      q = DataExplorer::Query.find(id)
      if q
        puts "Found query with id #{id}"
      end

      q.hidden = false
      q.save
      puts "Query no.#{id} is now visible" unless q.hidden
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
      puts "Error finding query with id #{id}"
      puts " "
    else
      q = DataExplorer::Query.find(id)
      if q
        puts "Found query with id #{id}"
      end

      if q.hidden
        DataExplorer.pstore_delete "q:#{id}"
        puts "Query no.#{id} has been deleted"
        puts " "
      else
        puts "Query no.#{id} must be hidden in order to hard delete"
        puts "To hide the query, run: " + "rake data_explorer[#{id}]"
        puts " "
      end
    end
  end
end
